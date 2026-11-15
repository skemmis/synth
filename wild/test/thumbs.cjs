// node wild/test/thumbs.cjs : stage screenshots of each build in a lively state, for the gallery
const {chromium}=require('playwright');const path=require('path');
const S={
'01-motley':()=>{for(let i=0;i<1500;i++)__t.step()},
'02-bloomfield':()=>{const q=__t.pel().slice().sort((a,b)=>a.x-b.x)[2];__t.line(27,75,q.x,q.y);for(let i=0;i<900;i++)__t.step()},
'03-wirehead':()=>{__t.setG([.2,.8,1.2,-.4,0,0,0,-.3,.2,0,1,.5]);for(let i=0;i<500;i++)__t.step()},
'04-gaitkeeper':async()=>{const ev=await new Promise(r=>__t.evolve(30,r));__t.set(ev.g);__t.toRun();for(let i=0;i<200;i++)__t.step()},
'05-cinderpit':()=>{for(const c of __t.find(7).filter((_,i)=>i%9==0))__t.put(c[0],c[1],5,0);for(let i=0;i<260;i++){for(let x=6;x<60;x+=3)if(i%2==0)__t.put(x,3,3,0);__t.step()}},
'06-gulp':()=>{for(let i=0;i<420;i++){const s=__t.stats(),ps=__t.pel();if(ps.length&&i%10==0){let b=ps[0],bd=1e9;for(const q of ps){const d=(q.x-s.x)**2+(q.y-s.y)**2;if(d<bd){bd=d;b=q}}__t.setTarget(b.x,b.y)}__t.step()}},
'07-mycel':()=>{for(let i=0;i<1500;i++){if(i%240==0){const c=__t.centroid(),ps=__t.pel().filter(q=>q.amt>100).sort((a,b)=>Math.hypot(a.x-c.x,a.y-c.y)-Math.hypot(b.x-c.x,b.y-c.y));const q=ps[Math.min(1,ps.length-1)];if(q)__t.line(c.x,c.y,q.x,q.y)}__t.step()}},
'08-sprout':()=>{for(let i=0;i<5200;i++)__t.step()},
'09-twitch':()=>{__t.setG(__t.PRESETS['Seeker that fears urchins']);for(let i=0;i<500;i++)__t.step()}};
(async()=>{const b=await chromium.launch();for(const k in S){const p=await b.newPage({viewport:{width:700,height:900},deviceScaleFactor:1});
  await p.goto('file://'+path.resolve(__dirname,'../play/'+k+'.html'));await p.waitForFunction(()=>!!window.__t);await p.evaluate(S[k]);await p.waitForTimeout(250);
  await p.evaluate(()=>{document.getElementById('hud').style.display='none'});
  await p.locator('canvas').first().screenshot({path:path.resolve(__dirname,'../thumbs/'+k+'.jpg'),type:'jpeg',quality:72});await p.close();console.log(k)}
await b.close()})();
