// node wild/test/all.cjs : every build loads, steps without errors, and fits a phone width
const {chromium}=require('playwright');const path=require('path');const fs=require('fs');
(async()=>{const b=await chromium.launch();let bad=0;
for(const f of fs.readdirSync(path.resolve(__dirname,'../play')).filter(f=>f.endsWith('.html'))){
  for(const vw of [1100,390]){const p=await b.newPage({viewport:{width:vw,height:800}});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
    await p.goto('file://'+path.resolve(__dirname,'../play/'+f));await p.waitForTimeout(400);
    const r=await p.evaluate(()=>{let st=null;if(window.__t){for(let i=0;i<300;i++)window.__t.step();st=window.__t.stats()}return{over:document.documentElement.scrollWidth-innerWidth,st}});
    if(errs.length||r.over>0)bad++;console.log(f,vw,'overflow',r.over,'errors',errs.length?errs:0,vw===1100?JSON.stringify(r.st):'');
    if(vw===390)await p.screenshot({path:path.resolve(__dirname,f.replace('.html','-phone.png')),fullPage:true});await p.close()}}
await b.close();process.exit(bad?1:0)})();
