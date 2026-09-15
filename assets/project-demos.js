(() => {
 document.querySelectorAll('[data-notes-demo]').forEach(root=>{
  const svg=root.querySelector('[data-notes-ink]'),layer=root.querySelector('[data-notes-strokes]'),undo=root.querySelector('[data-notes-undo]'),status=root.querySelector('[data-notes-status]'),text=root.querySelector('[data-notes-text]');
  const initialText=text.value,strokes=[];let color='#454139',active=null,frame=0;
  function announce(message){status.textContent=message;undo.disabled=!strokes.length;root.classList.toggle('has-ink',!!strokes.length||!!active)}
  function createPath(points,ink){const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('stroke',ink);p.setAttribute('stroke-width','3.5');p.setAttribute('d',points);layer.append(p);return p}
  function toPoint(e){const c=svg.getScreenCTM();if(!c)return null;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(c.inverse());return [Math.max(0,Math.min(800,p.x)),Math.max(0,Math.min(270,p.y))]}
  function drawActive(){frame=0;if(!active)return;active.path.setAttribute('d',active.points.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' '))}
  function cancelActive(){if(!active)return;const id=active.id;active.path.remove();active=null;if(frame){cancelAnimationFrame(frame);frame=0}if(svg.hasPointerCapture(id))svg.releasePointerCapture(id);announce(strokes.length+' ink '+(strokes.length===1?'stroke.':'strokes.'))}
  root.querySelectorAll('[data-ink]').forEach(button=>button.addEventListener('click',()=>{color=button.dataset.ink;root.querySelectorAll('[data-ink]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)))}));
  svg.addEventListener('pointerdown',e=>{if(active||e.button!==0)return;e.preventDefault();const p=toPoint(e);if(!p)return;active={id:e.pointerId,points:[p,[p[0]+.01,p[1]+.01]],path:createPath('M'+p.join(' ')+'l.01 .01',color)};svg.setPointerCapture(e.pointerId);root.classList.add('has-ink')});
  svg.addEventListener('pointermove',e=>{if(!active||e.pointerId!==active.id)return;const events=e.getCoalescedEvents?.()||[e];for(const evt of events){const p=toPoint(evt);if(p&&active.points.length<1600)active.points.push(p)}if(!frame)frame=requestAnimationFrame(drawActive)});
  svg.addEventListener('pointerup',e=>{if(!active||e.pointerId!==active.id)return;drawActive();const id=active.id;strokes.push(active.path);active=null;if(svg.hasPointerCapture(id))svg.releasePointerCapture(id);if(strokes.length>100)strokes.shift().remove();announce(strokes.length+' ink '+(strokes.length===1?'stroke.':'strokes.'))});
  svg.addEventListener('pointercancel',cancelActive);svg.addEventListener('lostpointercapture',()=>{if(active)cancelActive()});
  undo.addEventListener('click',()=>{cancelActive();strokes.pop()?.remove();announce(strokes.length?'Last mark undone.':'Ready for your first mark.')});
  root.querySelector('[data-notes-curve]').addEventListener('click',()=>{cancelActive();const path=createPath('M65 217 C115 177 150 140 215 108 C285 73 400 53 540 43 C610 39 650 38 710 36',color);path.setAttribute('pathLength','1');path.classList.add('sample-stroke');strokes.push(path);if(strokes.length>100)strokes.shift().remove();announce('Curve added. Draw an annotation, or undo it.')});
  root.querySelector('[data-notes-reset]').addEventListener('click',()=>{cancelActive();strokes.splice(0).forEach(p=>p.remove());text.value=initialText;announce('Page reset. Ready for your first mark.')});
  root.addEventListener('keydown',e=>{if(e.key==='Escape')cancelActive()});
  root.closest('.spotlight-panel')?.addEventListener('spotlight-hide',cancelActive);
 });
})();

(() => {
 document.querySelectorAll('[data-days-demo]').forEach(root=>{
  const complete=root.querySelector('[data-quest-complete]'),undo=root.querySelector('[data-quest-undo]');
  let done=false;
  function render(){
   root.classList.toggle('is-complete',done);
   root.querySelector('[data-quest-xp]').textContent=done?'534':'508';
   root.querySelector('[data-quest-glimmers]').textContent=done?'28':'20';
   root.querySelector('[data-quest-mind]').textContent=done?'122':'116';
   root.querySelector('[data-quest-xp-delta]').textContent=done?'+26':'+0';
   root.querySelector('[data-quest-glimmers-delta]').textContent=done?'+8':'+0';
   root.querySelector('[data-quest-mind-delta]').textContent=done?'+6':'+0';
   root.querySelector('[data-quest-state]').textContent=done?'Complete':'Ready';
   root.querySelector('[data-quest-button-label]').textContent=done?'Quest complete':'Complete sample Quest';
   root.querySelector('[data-quest-receipt]').textContent=done?'26 XP, 8 Glimmers and 6 Mind added.':'Ready when you are.';
   root.querySelector('[data-quest-progress-label]').textContent=(done?'1':'0')+' of 1 Quest complete';
   root.querySelector('[role=progressbar]').setAttribute('aria-valuenow',done?'1':'0');
   complete.disabled=done;undo.disabled=!done;
  }
  complete.addEventListener('click',()=>{if(done)return;done=true;render();undo.focus({preventScroll:true})});
  undo.addEventListener('click',()=>{if(!done)return;done=false;render();root.querySelector('[data-quest-receipt]').textContent='Completion undone. Every reward restored.';complete.focus({preventScroll:true})});
 });
})();

(() => {
  const supply = 5;

  const formatResistance = (ohms) => ohms >= 1000
    ? `${(ohms / 1000).toFixed(ohms % 1000 === 0 ? 0 : 1)} kΩ`
    : `${ohms} Ω`;

  const describeDivider = (r1, r2, vout) => {
    if (r1 === r2) return `R1 and R2 match, so the output is half the supply: ${vout.toFixed(2)} V.`;
    return r2 > r1
      ? `R2 is larger, so the output rises toward the 5 V supply: ${vout.toFixed(2)} V.`
      : `R1 is larger, so more voltage drops above the output node: ${vout.toFixed(2)} V.`;
  };

  document.querySelectorAll('[data-knowsy-demo]').forEach((demo) => {
    const r1Input = demo.querySelector('[data-knowsy-r1]');
    const r2Input = demo.querySelector('[data-knowsy-r2]');
    const values = {
      r1Output: demo.querySelector('[data-knowsy-r1-output]'),
      r2Output: demo.querySelector('[data-knowsy-r2-output]'),
      r1Label: demo.querySelector('[data-knowsy-r1-label]'),
      r2Label: demo.querySelector('[data-knowsy-r2-label]'),
      vout: demo.querySelector('[data-knowsy-vout]'),
      voutLabel: demo.querySelector('[data-knowsy-vout-label]'),
      current: demo.querySelector('[data-knowsy-current]'),
      status: demo.querySelector('[data-knowsy-status]'),
      netlist: demo.querySelector('[data-knowsy-netlist]'),
      nodeHalo: demo.querySelector('[data-knowsy-node-halo]'),
    };
    let announcementTimer;

    const render = (announce = false) => {
      const r1 = Number(r1Input.value);
      const r2 = Number(r2Input.value);
      const vout = supply * r2 / (r1 + r2);
      const currentMilliAmps = (supply / (r1 + r2)) * 1000;
      const r1Text = formatResistance(r1);
      const r2Text = formatResistance(r2);
      const voutText = `${vout.toFixed(2)} V`;

      [values.r1Output, values.r1Label].forEach((element) => { element.textContent = r1Text; });
      [values.r2Output, values.r2Label].forEach((element) => { element.textContent = r2Text; });
      [values.vout, values.voutLabel].forEach((element) => { element.textContent = voutText; });
      values.current.textContent = `${currentMilliAmps.toFixed(2)} mA`;
      values.netlist.textContent = `V1 VIN 0 DC 5\nR1 VIN OUT ${r1}\nR2 OUT 0 ${r2}`;
      r1Input.setAttribute('aria-valuetext', r1Text);
      r2Input.setAttribute('aria-valuetext', r2Text);
      values.nodeHalo.style.opacity = String(.12 + (vout / supply) * .34);
      values.nodeHalo.style.transform = `scale(${.75 + (vout / supply) * .75})`;
      demo.querySelectorAll('[data-knowsy-preset]').forEach((button) => {
        const [presetR1, presetR2] = button.dataset.knowsyPreset.split(',').map(Number);
        button.setAttribute('aria-pressed', String(r1 === presetR1 && r2 === presetR2));
      });

      window.clearTimeout(announcementTimer);
      if (announce) {
        announcementTimer = window.setTimeout(() => {
          values.status.textContent = describeDivider(r1, r2, vout);
        }, 260);
      }
    };

    [r1Input, r2Input].forEach((input) => {
      input.addEventListener('input', () => render(true));
      input.addEventListener('change', () => render(true));
    });

    demo.querySelectorAll('[data-knowsy-preset]').forEach((button) => {
      button.addEventListener('click', () => {
        const [r1, r2] = button.dataset.knowsyPreset.split(',');
        r1Input.value = r1;
        r2Input.value = r2;
        render(true);
      });
    });

    render();
  });
})();

(() => {
 document.querySelectorAll('[data-spotlight-tabs]').forEach(root=>{
  const tabs=Array.from(root.querySelectorAll('[role=tab]')),panels=Array.from(root.querySelectorAll('[role=tabpanel]'));
  function select(tab,focus){
   tabs.forEach(t=>{const on=t===tab;t.setAttribute('aria-selected',String(on));t.tabIndex=on?0:-1});
   panels.forEach(p=>{const on=p.id===tab.getAttribute('aria-controls');if(!on)p.dispatchEvent(new Event('spotlight-hide'));p.hidden=!on});
   if(focus)tab.focus({preventScroll:true});
  }
  tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>select(tab,false));tab.addEventListener('keydown',e=>{let n=null;if(e.key==='ArrowRight')n=(i+1)%tabs.length;if(e.key==='ArrowLeft')n=(i+tabs.length-1)%tabs.length;if(e.key==='Home')n=0;if(e.key==='End')n=tabs.length-1;if(n!==null){e.preventDefault();select(tabs[n],true)}})});
  select(tabs.find(tab=>tab.hasAttribute('data-default-tab'))||tabs[0],false);
 });
 document.documentElement.classList.add('demos-ready');
})();
