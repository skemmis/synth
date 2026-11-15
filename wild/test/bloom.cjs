const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1100,height:900}});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+path.resolve(__dirname,'../play/02-bloomfield.html'));await p.waitForFunction(()=>!!window.__t);
const out=await p.evaluate(()=>{const t=window.__t,r=[];
 for(let i=0;i<600;i++){t.step();if(i%150==149)r.push(['idle',i,t.stats()])}
 const q=t.pel()[0];t.line(27,75,q.x,q.y);
 for(let i=0;i<1500;i++){t.step();if(i%150==149)r.push(['line',i,t.stats()])}
 return r});
console.log(out.map(o=>JSON.stringify(o)).join('\n'),errs);await p.screenshot({path:path.resolve(__dirname,'02-bloomfield.png'),fullPage:false});await b.close()})();
