function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const $=id=>document.getElementById(id);
function makeStage(canvas,W,H){const ctx=canvas.getContext('2d');let s=1;canvas.style.aspectRatio=W+'/'+H;
  function fit(){const r=canvas.getBoundingClientRect();const dpr=Math.min(window.devicePixelRatio||1,2);const w=Math.max(1,Math.round(r.width*dpr));if(w===canvas.width)return;canvas.width=w;canvas.height=Math.round(w*H/W);s=w/W}
  if(window.ResizeObserver)new ResizeObserver(fit).observe(canvas);fit();
  return{ctx,W,H,begin(){fit();s=canvas.width/W;ctx.setTransform(s,0,0,s,0,0)},pos(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H}}}}
function onPointer(canvas,stage,h){let down=false;
  canvas.addEventListener('pointerdown',e=>{down=true;try{canvas.setPointerCapture(e.pointerId)}catch(_){}h.down&&h.down(stage.pos(e),e);e.preventDefault()});
  canvas.addEventListener('pointermove',e=>{h.move&&h.move(stage.pos(e),down,e)});
  const up=e=>{if(down){down=false;h.up&&h.up(stage.pos(e),e)}};canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
  canvas.addEventListener('pointerleave',e=>{h.leave&&h.leave()});
  canvas.addEventListener('contextmenu',e=>e.preventDefault())}
function runLoop(o){let paused=false,speed=o.speed||1;const pb=$('pause');
  if(pb)pb.onclick=()=>{paused=!paused;pb.textContent=paused?'Play':'Pause'};
  function frame(){if(!paused)for(let i=0;i<speed;i++)o.step();o.draw();requestAnimationFrame(frame)}
  requestAnimationFrame(frame);
  return{setSpeed(v){speed=v},get paused(){return paused},set paused(v){paused=v;if(pb)pb.textContent=paused?'Play':'Pause'}}}
function toolbar(ids,onPick){let cur=ids[0];ids.forEach(id=>{const b=$(id);b.setAttribute('aria-pressed',id===cur);b.onclick=()=>{cur=id;ids.forEach(j=>$(j).setAttribute('aria-pressed',j===id));onPick&&onPick(id)}});return()=>cur}
