const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
await p.goto('file://'+path.resolve(__dirname,'../play/08-sprout.html'));await p.waitForFunction(()=>!!window.__t);
const out=await p.evaluate(()=>{const t=window.__t,r={};for(const [pv,up] of [[2,1],[3,1],[3,.6],[4,.6]]){t.cfg(pv,up);for(const k of ['Tadpole','Solar skiff','One lonely mouth']){const a=[];for(let s=0;s<6;s++){t.load(k);for(let i=0;i<7200;i++)t.step();a.push(t.stats().cells)}r[pv+'/'+up+' '+k]=a.join(',')}}return r});
console.log(out);await b.close()})();
