const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
await p.goto('file://'+path.resolve(__dirname,'../play/08-sprout.html'));await p.waitForFunction(()=>!!window.__t);
const T=(job,split,a,b,join,side)=>({job,split,a,b,join,side});const tail=T(1,0,2,2,1,0),leaf=T(2,0,3,3,0,0);
const C={ribbon:[T(0,2.6,0,2,1,1),T(0,0,1,1,0,0),tail,leaf],
 ribbon2:[T(0,2.6,0,1,1,1),T(0,2.6,1,2,1,0),tail,leaf],
 skiff:[T(2,2.6,0,1,1,0),T(0,2.6,1,2,1,0),tail,leaf],
 leafraft:[T(2,1.6,0,0,1,1),T(0,0,1,1,0,0),tail,leaf],
 mouthraft:[T(0,1.6,0,0,1,1),T(0,0,1,1,0,0),tail,leaf],
 colony:[T(0,4,1,1,0,0),T(0,2.6,1,2,1,0),tail,leaf]};
const out=await p.evaluate((C)=>{const t=window.__t,r={};for(const k in C){t.setG(C[k]);const a=[];for(let i=0;i<7200;i++){t.step();if(i%1800==1799)a.push(t.stats())}r[k]=a.map(s=>s.cells+'c/'+s.perMin+'pm/'+s.bonds+'b').join('  ')}return r},C);
console.log(out);await b.close()})();
