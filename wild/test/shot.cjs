// node wild/test/shot.cjs NN-name [frames] : load a build, run it, report errors and stats, save a screenshot
const {chromium}=require('playwright');const path=require('path');
(async()=>{const name=process.argv[2],steps=+(process.argv[3]||600);
  const b=await chromium.launch();const p=await b.newPage({viewport:{width:1100,height:900},deviceScaleFactor:1});
  const errs=[];p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>{if(m.type()==='error'&&!/fonts|ERR_/.test(m.text()))errs.push(m.text())});
  await p.goto('file://'+path.resolve(__dirname,'../play/'+name+'.html'));await p.waitForFunction(()=>!!window.__t,null,{timeout:5000}).catch(()=>{});
  const t0=Date.now();const st=await p.evaluate(n=>{if(!window.__t)return'no __t';for(let i=0;i<n;i++)window.__t.step();return window.__t.stats()},steps);
  console.log(name,'steps',steps,'ms',Date.now()-t0,JSON.stringify(st),'errors',errs);
  await p.waitForTimeout(300);await p.screenshot({path:path.resolve(__dirname,name+'.png'),fullPage:true});await b.close()})();
