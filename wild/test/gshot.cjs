const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:900}});await p.goto('file://'+path.resolve(__dirname,'../play/index.html'));await p.waitForTimeout(500);await p.screenshot({path:path.resolve(__dirname,'gallery.png'),fullPage:true});await b.close()})();
