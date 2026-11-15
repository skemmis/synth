const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1100,height:900}});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+path.resolve(__dirname,'../play/04-gaitkeeper.html'));await p.waitForFunction(()=>!!window.__t);
const out=await p.evaluate(async()=>{const t=window.__t,r={};
 for(const k of ['Tripod','Caterpillar']){t.load(t.PRESETS[k]);r[k+'_untrained']=Math.round(t.score(t.defGenome()));const t0=performance.now();const runs=[];for(let i=0;i<3;i++){const ev=await new Promise(res=>t.evolve(30,res));runs.push(Math.round(ev.f));if(i==2){t.set(ev.g)}}r[k+'_bred']=runs;r[k+'_ms']=Math.round((performance.now()-t0)/3)}
 t.toRun();for(let i=0;i<300;i++)t.step();r.st=t.stats();return r});
console.log(out,errs);await p.screenshot({path:path.resolve(__dirname,'04-gaitkeeper.png')});await b.close()})();
