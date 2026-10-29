import {readFileSync as read,writeFileSync as write,mkdirSync} from 'node:fs';
const s=JSON.parse(read('paper/data/summary.generated.json')), c=JSON.parse(read('paper/config.json'));
mkdirSync('paper/generated',{recursive:true});
const f=x=>x.toFixed(3), interval=x=>`${f(x.value)} [${f(x.low)}, ${f(x.high)}]`;
const abstract=`Benchmark Skateboard tests consistency between signed rotations, projectile arithmetic, and landing constraints under an explicit simplified model. Its ${s.taskCount} public tasks cross ${s.trickCount} trick definitions with three gravity settings. We evaluate scripted controls through the benchmark runner and conduct a simulated population experiment with numeric and rotation corruption. A glossary-assisted analytic control reaches full credit on every task. Reversing rotation signs retains a mean score of ${f(s.fixed.find(x=>x.condition.name==='reverse-sign').mean.value)}, showing why partial credit must accompany complete-answer accuracy. Numeric perturbations reveal a sharp tolerance boundary with an absolute rounding-floor exception. Simulated repair layers separate arithmetic recovery from consistency with corrupted rotations. All results are generated locally without paid inference. These findings characterize the measurement instrument; they do not establish learned-model skill or real-world skateboarding ability.`;
write('paper/meta.json',JSON.stringify({schema_version:1,title:c.title,abstract,authors:[{name:'Pooria Arab',affiliation:'Independent researcher',orcid:c.orcid}],license:'CC-BY-4.0',keywords:c.keywords,code_url:c.code_url,artifact_name:c.artifact_name},null,2)+'\n');
const macros={PaperTitle:c.title,PaperAbstract:abstract,TaskCount:s.taskCount,TrickCount:s.trickCount,SimAgentCount:s.agentCount,SimMultiplier:s.corruptionMultiplier,BootstrapDraws:s.bootstrapDraws,ConditionCount:s.conditions,ObservationCount:s.observations,AuthorOrcid:c.orcid.replace('https://orcid.org/','')};
for(const [name,policy] of [['Oracle','analytic'],['Constant','constant-zero'],['Always','always-true'],['Reverse','reverse-sign']]) {const r=s.fixed.find(x=>x.condition.name===policy);macros[name+'Mean']=interval(r.mean);macros[name+'Full']=interval(r.full);}
for(const control of ['none','physics','boolean']) {const r=s.simulated.find(x=>x.q===.5&&x.control===control);macros['Sim'+control]=interval(r.mean); if(control!=='none') macros['Gain'+control]=interval(s.contrasts.find(x=>x.q===.5&&x.control===control).gain);}
macros.SensitivityOutside=interval(s.fixed.find(x=>x.condition.factor===1.06).mean);
write('paper/generated/macros.tex',Object.entries(macros).map(([k,v])=>`\\newcommand{\\${k}}{${v}}`).join('\n')+'\n');
function table(file,header,rows){write(`paper/generated/${file}.tex`,'\\begin{tabular}{'+('l'.repeat(header.length))+'}\\toprule\n'+header.join(' & ')+'\\\\ \\midrule\n'+rows.map(r=>r.join(' & ')+'\\\\').join('\n')+'\n\\bottomrule\\end{tabular}\n');}
table('baselines',['Policy','Mean [cluster CI]','Full [Wilson CI]'],s.fixed.filter(x=>x.condition.kind==='baseline').map(x=>[x.condition.name,interval(x.mean),interval(x.full)]));
table('coverage',['World','Tasks','Feasible count','Wheels-down count'],s.coverage.map(x=>[x.world,x.n,x.feasible,x.wheelsDown]));
table('sensitivity',['Physics factor','Mean [cluster CI]','Full [Wilson CI]'],s.fixed.filter(x=>x.condition.kind==='sensitivity').map(x=>[x.condition.factor,interval(x.mean),interval(x.full)]));
table('simulated',['Corruption','Simulated control','Mean [agent CI]','Full [agent CI]'],s.simulated.map(x=>[x.q,x.control,interval(x.mean),interval(x.full)]));
table('gains',['Corruption','Simulated control','Paired gain [agent CI]'],s.contrasts.map(x=>[x.q,x.control,interval(x.gain)]));
function csv(file,header,rows){write(`paper/figures/${file}.generated.csv`,header+'\n'+rows.map(x=>x.join(',')).join('\n')+'\n');}
const point=(x,r)=>[x,r.value,r.value-r.low,r.high-r.value];
csv('baselines','x,y,minus,plus',s.fixed.filter(x=>x.condition.kind==='baseline').map((x,i)=>point(i,x.mean)));
csv('sensitivity','x,y,minus,plus',s.fixed.filter(x=>x.condition.kind==='sensitivity').map(x=>point(x.condition.factor,x.mean)));
csv('coverage','x,n,feasible,wheels',s.coverage.map((x,i)=>[i,x.n,x.feasible,x.wheelsDown]));
for(const control of ['none','physics','boolean']) csv(`sim-${control}`,'x,y,minus,plus',s.simulated.filter(x=>x.control===control).map(x=>point(x.q,x.mean)));
const plot=(file,axis,plots,caption)=>write(`paper/figures/${file}.tex`,String.raw`\begin{figure}[ht]\centering
\begin{tikzpicture}\begin{axis}[${axis}]
${plots}
\end{axis}\end{tikzpicture}
\caption{${caption}}\label{fig:${file}}
\end{figure}
`);
const series=(file,color)=>String.raw`\addplot+[color=${color},mark=*,error bars/.cd,y dir=both,y explicit] table[x=x,y=y,y error minus=minus,y error plus=plus,col sep=comma]{figures/${file}.generated.csv};`;
plot('baselines','ymin=0,ymax=1.1,ylabel={Mean score},xtick={0,1,2,3,4,5,6},xticklabels={Analytic,Empty,Refuse,Echo,Constant,True,Reverse},x tick label style={rotate=25,anchor=east}',series('baselines','okblue'),'Scripted controls separate full solutions from partial credit. Bars show 95\\% trick-cluster bootstrap intervals. The sign-reversed control preserves correct arithmetic.');
plot('sensitivity','ymin=0,ymax=1.1,xlabel={Multiplier on both exact physics values},ylabel={Mean score}',series('sensitivity','okorange'),'Physics tolerance creates a sharp score boundary. Bars show 95\\% trick-cluster bootstrap intervals. The absolute rounding floor preserves a small amount of height credit outside the relative band.');
plot('population','ymin=0,ymax=1.1,xlabel={Simulated corruption probability},ylabel={Simulated mean score},legend style={font=\\footnotesize,at={(0.02,0.02)},anchor=south west}',['none','physics','boolean'].map((v,i)=>series(`sim-${v}`,['black','okblue','okorange'][i])).join('\n')+'\n\\legend{No repair,Physics repair,Boolean repair}','Simulated population sweep with paired random draws. Bars show 95\\% bootstrap intervals over agent seeds. Simulated physics repair restores arithmetic; simulated boolean repair can propagate rotation errors.');
plot('coverage','ybar,ymin=0,ylabel={Task count},xtick={0,1,2},xticklabels={Earth,Moon,Mars},legend style={font=\\footnotesize,at={(0.5,1.02)},anchor=south}',String.raw`\addplot table[x=x,y=n,col sep=comma]{figures/coverage.generated.csv};\addplot table[x=x,y=feasible,col sep=comma]{figures/coverage.generated.csv};\addplot table[x=x,y=wheels,col sep=comma]{figures/coverage.generated.csv};\legend{All,Feasible,Wheels down}`,'Coverage counts describe the complete public panel. These are inventory totals, not estimated population rates. Equal world counts do not imply equal feasibility counts.');
console.log('Generated metadata, tables, macros, and four figures.');
