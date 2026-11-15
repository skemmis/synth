const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1100,height:900}});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+path.resolve(__dirname,'../play/10-pitdiver.html'));await p.waitForFunction(()=>!!window.__t);
const out=await p.evaluate(()=>{const t=window.__t,r=[];r.push(t.stats());
 // 1: swim under the lowest moss cell, spark it
 const moss=t.find(7);const low=moss.filter(c=>c[0]>100).reduce((a,c)=>c[1]>a[1]?c:a,[0,0]);const mx=low[0]*5,my=low[1]*5;
 for(const [x,y] of [[mx-70,470],[mx-70,my+70],[mx,my+70]])for(let i=0;i<300;i++){t.setTarget(x,y);t.step()}r.push(['under plug',mx,my,t.stats()]);
 t.pick(5);t.setTarget(mx,my);t.squirt(true);for(let i=0;i<40;i++)t.step();t.squirt(false);r.push(['sparked',t.stats()]);
 for(let i=0;i<500;i++){t.setTarget(mx,my+30);t.step()}r.push(['waited under',t.stats()]);
 return r});
console.log(out.map(o=>JSON.stringify(o)).join('\n'),errs);await p.screenshot({path:path.resolve(__dirname,'10-pitdiver.png')});await b.close()})();
