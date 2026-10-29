import { readFileSync as read, writeFileSync as write, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { run, loadTasksFile } from '../../dist/index.js';
import { mean, bootstrap, wilson } from '../template/stats.mjs';
export const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export const tasks = await loadTasksFile();
const glossary = JSON.parse(read('data/tricks.json'));
const byName = new Map(glossary.tricks.map(t => [t.name.toLowerCase(), t]));
const round = x => Math.round(x * 1000) / 1000;
function analytic(prompt) {
  const trick = byName.get(prompt.match(/attempts an? (.*?) on (?:Earth|the Moon|Mars)\./)[1]);
  const g = +prompt.match(/Use gravity ([\d.]+) m\/s/)[1], v = +prompt.match(/upward launch speed ([\d.]+) m\/s/)[1];
  const minimum = +prompt.match(/needs at least ([\d.]+) s/)[1], time = 2*v/g, height = v*v/(2*g);
  const rotations = {...trick.rotations};
  return {answer:{rotations,airtimeS:round(time),peakHeightM:round(height),landsWheelsDown:Number.isInteger(rotations.long)&&Number.isInteger(rotations.cross),canFlipFinishInAir:time+1e-9>=minimum},time,height,minimum};
}
function random(seed, prompt, field) { return parseInt(hash(`${seed}:${prompt}:${field}`).slice(0,8),16)/2**32; }
function response(c, prompt) {
  if(c.name==='empty') return '';
  if(c.name==='refuse') return 'I cannot answer.';
  if(c.name==='echo') return prompt;
  const {answer:a,time,height,minimum} = analytic(prompt);
  if(c.name==='constant-zero') return JSON.stringify({rotations:{long:0,vertical:0,cross:0},airtimeS:0,peakHeightM:0,landsWheelsDown:true,canFlipFinishInAir:true});
  if(c.name==='always-true') a.landsWheelsDown=a.canFlipFinishInAir=true;
  if(c.name==='reverse-sign') for(const k of Object.keys(a.rotations)) a.rotations[k]*=-1;
  if(c.kind==='sensitivity') {a.airtimeS=time*c.factor; a.peakHeightM=height*c.factor;}
  if(c.kind==='simulated') {
    if(random(c.seed,prompt,'rotation')<c.q) a.rotations.long+=.5;
    if(random(c.seed,prompt,'time')<c.q) a.airtimeS*=1.10;
    if(random(c.seed,prompt,'height')<c.q) a.peakHeightM*=1.10;
    if(c.control==='physics') {a.airtimeS=round(time); a.peakHeightM=round(height);}
    if(c.control==='boolean') {a.landsWheelsDown=Number.isInteger(a.rotations.long)&&Number.isInteger(a.rotations.cross); a.canFlipFinishInAir=a.airtimeS+1e-9>=minimum;}
  }
  return JSON.stringify(a);
}
export const conditions = [
  ...['analytic','empty','refuse','echo','constant-zero','always-true','reverse-sign'].map(name=>({kind:'baseline',name})),
  ...[.94,.96,1,1.04,1.06,1.1].map(factor=>({kind:'sensitivity',name:`factor-${factor}`,factor})),
  ...[0,.25,.5,.75,1].flatMap(q=>['none','physics','boolean'].flatMap(control=>Array.from({length:20},(_,i)=>({kind:'simulated',name:`sim-${q}-${control}-${i+1}`,q,control,seed:i+1}))))
];
const semantic = report => report.rows.map(r=>({taskId:r.taskId,score:r.score,submission:r.submission,reason:r.reason,details:r.details}));
async function collect() {
  const out=[];
  for(const c of conditions) {
    const report=await run({id:`scripted:${c.name}`,async complete(prompt){return {content:response(c,prompt)};},async chat(){throw Error('Unexpected chat');}});
    out.push({condition:c,report});
  }
  return out;
}
export function summarize(runs) {
  const trickGroups = rows => glossary.tricks.map(t=>rows.filter(r=>tasks.find(x=>x.id===r.taskId).metadata.trick===t.id));
  const statistic = groups => mean(groups.flat().map(r=>r.score));
  const fixed=runs.filter(r=>r.condition.kind!=='simulated').map(({condition,report})=>({condition,mean:bootstrap([trickGroups(report.rows)],g=>statistic(g[0])),full:wilson(report.rows.filter(r=>r.score===1).length,report.rows.length),fullCluster:bootstrap([trickGroups(report.rows)],g=>mean(g[0].flat().map(r=>+(r.score===1)))),breakdown:report.breakdown}));
  const simulated=[], contrasts=[];
  for(const q of [0,.25,.5,.75,1]) for(const control of ['none','physics','boolean']) {
    const cells=runs.filter(r=>r.condition.kind==='simulated'&&r.condition.q===q&&r.condition.control===control);
    const agents=cells.map(r=>({seed:r.condition.seed,score:mean(r.report.rows.map(x=>x.score)),full:mean(r.report.rows.map(x=>+(x.score===1)))}));
    simulated.push({q,control,agents,mean:bootstrap([agents],g=>mean(g[0].map(a=>a.score))),full:bootstrap([agents],g=>mean(g[0].map(a=>a.full)))});
    if(control!=='none') {
      const base=simulated.find(s=>s.q===q&&s.control==='none');
      contrasts.push({q,control,gain:bootstrap([agents.map((a,i)=>a.score-base.agents[i].score)],g=>mean(g[0]))});
    }
  }
  const coverage=['earth','moon','mars'].map(world=>{const ts=tasks.filter(t=>t.metadata.world===world); return {world,n:ts.length,feasible:ts.filter(t=>JSON.parse(t.expected).canFlipFinishInAir).length,wheelsDown:ts.filter(t=>JSON.parse(t.expected).landsWheelsDown).length};});
  return {fixed,simulated,contrasts,coverage,agentCount:simulated[0].agents.length,corruptionMultiplier:1.10,bootstrapDraws:2000,taskCount:tasks.length,trickCount:glossary.tricks.length,conditions:conditions.length,observations:runs.reduce((n,r)=>n+r.report.rows.length,0),freeModels:'Not configured; provider availability not probed',costUsd:0};
}
if(process.argv[1]?.endsWith('/run.mjs')||process.argv[1]==='paper/scripts/run.mjs') {
  mkdirSync('paper/data',{recursive:true});
  const runs=await collect(), repeat=await collect();
  const hashes=runs.map(r=>hash(semantic(r.report))), repeated=repeat.map(r=>hash(semantic(r.report)));
  if(JSON.stringify(hashes)!==JSON.stringify(repeated)) throw Error('Semantic repeat mismatch');
  const save=(name,value)=>write(`paper/data/${name}.generated.json`,JSON.stringify(value,null,2)+'\n');
  save('runs',runs); save('repeat',{hashes,repeated,match:true}); save('summary',summarize(runs));
  const paths=['src/grading.ts','src/index.ts','src/report.ts','src/benchmark.ts','src/tasks.ts','data/tasks.jsonl','data/tricks.json','package-lock.json','paper/PREREG.md','paper/config.json','paper/scripts/run.mjs','paper/template/stats.mjs','paper/scripts/render.mjs','paper/scripts/verify.mjs','paper/paper.tex','paper/references.bib'];
  save('provenance',{sourceCommit:JSON.parse(read('paper/config.json')).source_commit,planCommit:execFileSync('git',['log','--reverse','--format=%H','--','paper/PREREG.md'],{encoding:'utf8'}).trim().split('\n')[0],node:process.version,hashes:Object.fromEntries(paths.map(p=>[p,hash(read(p,'utf8'))])),semanticHashes:hashes});
  console.log(`Collected ${runs.length} conditions twice; ${runs.reduce((n,r)=>n+r.report.rows.length,0)} observations per pass; semantic hashes match.`);
}
