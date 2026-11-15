const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1100,height:900}});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+path.resolve(__dirname,'../play/05-cinderpit.html'));await p.waitForFunction(()=>!!window.__t);
await p.screenshot({path:path.resolve(__dirname,'05-cinderpit-a.png')});
const out=await p.evaluate(()=>{const t=window.__t,r=[];const bb=k=>{const c=t.find(k);if(!c.length)return null;const xs=c.map(a=>a[0]),ys=c.map(a=>a[1]);return[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]};
 r.push(['start',t.stats()]);
 // spark every moss cell region top (fuse + plugs)
 for(const c of t.find(7).filter((_,i)=>i%9==0))t.put(c[0],c[1],5,0);
 for(let i=0;i<400;i++)t.step();r.push(['after sparks on moss',t.stats()]);
 // flood: pour water along the top for a while
 for(let i=0;i<900;i++){for(let x=6;x<174;x+=3)if(i%2==0)t.put(x,3,3,0);t.step()}
 for(let i=0;i<600;i++)t.step();r.push(['after flood',t.stats()]);
 return r});
console.log(out.map(o=>JSON.stringify(o)).join('\n'),errs);await p.screenshot({path:path.resolve(__dirname,'05-cinderpit-b.png')});await b.close()})();
