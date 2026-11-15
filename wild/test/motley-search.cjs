const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
await p.goto('file://'+path.resolve(__dirname,'../play/01-motley.html'));await p.waitForFunction(()=>!!window.__t);
const out=await p.evaluate(()=>{const t=window.__t,res=[];for(let k=0;k<36;k++){const m=t.randM();t.setM(m);t.reset();for(let i=0;i<600;i++)t.step();const e0=t.stats().eaten;for(let i=0;i<1500;i++)t.step();res.push({r:t.stats().eaten-e0,m})}
 // blank and appetite-only baselines
 const z=()=>Array.from({length:5},()=>[0,0,0,0,0]);let m=z();t.setM(m);t.reset();for(let i=0;i<2100;i++)t.step();res.push({r:t.stats().eaten,m:'blank'});
 m=z();m.forEach((r,i)=>{if(i<4)r[4]=1});t.setM(m);t.reset();for(let i=0;i<2100;i++)t.step();res.push({r:t.stats().eaten,m:'followpale'});
 return res});
out.sort((a,b)=>b.r-a.r);console.log(out.map(o=>o.r).join(' '));for(const o of out.slice(0,4))console.log(o.r,JSON.stringify(o.m));console.log(JSON.stringify(out.filter(o=>typeof o.m==='string')));await b.close()})();
