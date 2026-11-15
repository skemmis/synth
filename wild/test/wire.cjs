const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1100,height:1000}});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+path.resolve(__dirname,'../play/03-wirehead.html'));await p.waitForFunction(()=>!!window.__t);
const out=await p.evaluate(async()=>{const t=window.__t,r={};
 const G={drift:[0,0,0,0,0,0,0,0,0,0,.5,.5],blank:Array(12).fill(0),seeker:[0,1,1,0,0,0,0,0,0,0,.5,.5],uncrossed:[1,0,0,1,0,0,0,0,0,0,.5,.5],seekAvoid:[0,1,1,0,1,0,0,1,0,0,.5,.5],seekBrake:[0,1,1,0,-1,-1,-1,-1,0,0,.5,.5],loop:[0,1,1,0,0,0,0,0,.4,0,.5,.5]};
 for(const k in G)r[k]=t.fitness(Float32Array.from(G[k])).toFixed(1);
 t.setG(G.seeker);const t0=performance.now();const ev=await new Promise(res=>t.evolve(15,res));r.evolved=ev.f.toFixed(1);r.g=Array.from(ev.g,v=>+v.toFixed(1)).join(',');r.ms=Math.round(performance.now()-t0);t.setG(Array.from(ev.g));for(let i=0;i<1200;i++)t.step();return r});
console.log(out,errs);await p.screenshot({path:path.resolve(__dirname,'03-wirehead.png'),fullPage:true});await b.close()})();
