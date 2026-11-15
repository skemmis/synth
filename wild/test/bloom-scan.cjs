const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
await p.goto('file://'+path.resolve(__dirname,'../play/02-bloomfield.html'));await p.waitForFunction(()=>!!window.__t);
const out=await p.evaluate(()=>{const t=window.__t,r=[];
 for(const F of [.022,.026,.030,.034])for(const k of [.061,.062,.063,.064,.065,.066]){t.reset();t.set(F,k);const m=[];for(let i=0;i<500;i++){t.step();if(i==60||i==250||i==499)m.push(t.stats().mass)}r.push([F,k,...m])}
 return r});
console.log(out.map(o=>o.join(' ')).join('\n'));await b.close()})();
