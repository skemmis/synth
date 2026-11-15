const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1100,height:1100}});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+path.resolve(__dirname,'../play/09-twitch.html'));await p.waitForFunction(()=>!!window.__t);
const out=await p.evaluate(async()=>{const t=window.__t,r={};const P=t.PRESETS;
 for(const k in P){const t0=performance.now();r[k]=t.fitness(Float32Array.from(P[k]),2400).toFixed(1);r.msPerEval=Math.round(performance.now()-t0)}
 const pulse=P['Seeker'].slice();pulse[8*4+0]=1;r.seekerPulse=t.fitness(Float32Array.from(pulse),2400).toFixed(1);
 const same=new Array(40).fill(0);for(let s=0;s<4;s++)same[s*4+s]=1;r.sameSide=t.fitness(Float32Array.from(same),2400).toFixed(1);
 t.setG(P['Seeker']);const t0=performance.now();const ev=await new Promise(res=>t.evolve(8,14,res));r.bred1500=ev.f.toFixed(1);r.bred2400=t.fitness(ev.g,2400).toFixed(1);r.seeker1500=t.fitness(Float32Array.from(P.Seeker),1500).toFixed(1);r.breedMs=Math.round(performance.now()-t0);r.g=Array.from(ev.g,v=>+v.toFixed(1)).join(',');
 t.setG(Array.from(ev.g));for(let i=0;i<900;i++)t.step();r.st=t.stats();return r});
console.log(out,errs);await p.screenshot({path:path.resolve(__dirname,'09-twitch.png'),fullPage:true});await b.close()})();
