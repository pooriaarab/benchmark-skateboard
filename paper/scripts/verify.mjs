import assert from 'node:assert/strict';
import {readFileSync as read,writeFileSync as write} from 'node:fs';
import {execFileSync as exec} from 'node:child_process';
import {gradeSkateboard,parseAnswer} from '../../dist/index.js';
import {hash,tasks,summarize} from './run.mjs';
const json=p=>JSON.parse(read(p)), runs=json('paper/data/runs.generated.json'), s=json('paper/data/summary.generated.json');
const provenance=json('paper/data/provenance.generated.json'), repeat=json('paper/data/repeat.generated.json'), meta=json('paper/meta.json');
assert.deepEqual(s,summarize(runs));
assert.equal(runs.length,313); assert.equal(s.observations,22536);
for(const {condition,report} of runs) {
  assert.equal(report.rows.length,tasks.length); assert.equal(new Set(report.rows.map(r=>r.taskId)).size,tasks.length);
  for(const row of report.rows) {
    const task=tasks.find(t=>t.id===row.taskId); assert.ok(task);
    assert.equal(row.score,gradeSkateboard(task,row.submission).score);
    if(condition.name==='analytic') assert.equal(row.score,1);
    if(['empty','refuse','echo'].includes(condition.name)) assert.equal(row.score,0);
    if(condition.kind==='sensitivity'&&Math.abs(condition.factor-1)<.05) assert.equal(row.score,1);
  }
}
const semantic=r=>r.report.rows.map(x=>({taskId:x.taskId,score:x.score,submission:x.submission,reason:x.reason,details:x.details}));
assert.deepEqual(runs.map(r=>hash(semantic(r))),repeat.hashes); assert.deepEqual(repeat.hashes,repeat.repeated);
for(const [path,digest] of Object.entries(provenance.hashes)) assert.equal(hash(read(path,'utf8')),digest,path);
for(const path of ['src/grading.ts','src/index.ts','src/report.ts','src/benchmark.ts','src/tasks.ts','data/tasks.jsonl','data/tricks.json','package-lock.json']) assert.equal(hash(exec('git',['show',`${provenance.sourceCommit}:${path}`],{encoding:'utf8'})),hash(read(path,'utf8')));
assert.ok(meta.abstract.length<=1920&&/^[\x00-\x7f]*$/.test(meta.abstract)); assert.equal(meta.license,'CC-BY-4.0');
assert.ok(read('CITATION.cff','utf8').includes(meta.title)); assert.ok(!read('paper/paper.tex','utf8').includes('\u2014'));
const pdf=exec('pdfinfo',['paper/skateboard-paper.pdf'],{encoding:'utf8'}), pages=+pdf.match(/Pages:\s+(\d+)/)[1]; assert.ok(pages>=8);
const text=exec('pdftotext',['paper/skateboard-paper.pdf','-'],{encoding:'utf8'}); assert.ok(!text.includes('??')); assert.ok(text.includes('simulated'));
for(const x of [...s.fixed.map(x=>x.mean),...s.simulated.map(x=>x.mean)]) assert.ok(x.low<=x.value+1e-12&&x.high>=x.value-1e-12);
const records=runs.filter(x=>x.condition.name==='factor-1.06')[0].report.rows;
const exceptions=records.filter(r=>r.score>.24).map(r=>{const t=tasks.find(t=>t.id===r.taskId);return {taskId:r.taskId,score:r.score,answer:parseAnswer(r.submission.answer),referenceHeight:t.metadata.launchSpeed**2/(2*t.metadata.gravity)};});
write('paper/data/verification.generated.json',JSON.stringify({passed:true,pages,conditions:runs.length,observations:s.observations,repeatMatch:repeat.match,rawScoresRechecked:s.observations,roundingFloorExceptions:exceptions,template:'Unchanged accepted pilot template; compared separately with diff -r'},null,2)+'\n');
console.log(`PASS: ${pages} PDF pages; ${s.observations} raw scores rechecked; ${runs.length} repeat hashes match; source freeze, summaries, metadata, and intervals verified.`);
