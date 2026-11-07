import assert from 'node:assert/strict';

// Chromium desktop cannot summon an Android IME. Simulate the visual viewport
// contract separately from layout resizing and label the resulting evidence.
export async function installViewport(context){
 await context.addInitScript(()=>{
  const view=new EventTarget(),listeners={resize:new Set(),scroll:new Set()};
  Object.assign(view,{height:innerHeight,width:innerWidth,offsetTop:0,offsetLeft:0,scale:1});
  const add=view.addEventListener.bind(view),remove=view.removeEventListener.bind(view);
  view.addEventListener=(type,fn,...rest)=>{listeners[type]?.add(fn);add(type,fn,...rest);};
  view.removeEventListener=(type,fn,...rest)=>{listeners[type]?.delete(fn);remove(type,fn,...rest);};
  Object.defineProperty(window,'visualViewport',{configurable:true,value:view});
  window.testViewport=(values)=>{Object.assign(view,values);view.dispatchEvent(new Event('resize'));view.dispatchEvent(new Event('scroll'));};
  window.viewportListeners=()=>Object.fromEntries(Object.entries(listeners).map(([key,set])=>[key,set.size]));
 });
}

export async function checkKeyboard(page,width,output){
 const field=page.locator('#creative-story');await field.focus();
 const original=await field.inputValue();
 for(const state of [
  {name:'keyboard',width,height:410,offsetTop:0,offsetLeft:0},
  {name:'keyboard-pan',width,height:340,offsetTop:120,offsetLeft:0},
  {name:'landscape-keyboard',width:640,height:260,offsetTop:0,offsetLeft:0},
  {name:'narrow-keyboard',width:320,height:350,offsetTop:40,offsetLeft:0},
  {name:'keyboard-dismissed',width,height:900,offsetTop:0,offsetLeft:0}
 ]){
  await page.setViewportSize({width:state.width,height:900});
  await page.evaluate(s=>window.testViewport(s),state);
  await page.waitForTimeout(100);
  const result=await page.evaluate(()=>{
   const view=visualViewport,d=document.querySelector('#ainoa-conversation'),box=d.getBoundingClientRect();
   const inside=el=>{const r=el.getBoundingClientRect();return r.top>=view.offsetTop-1&&r.bottom<=view.offsetTop+view.height+1&&r.left>=view.offsetLeft-1&&r.right<=view.offsetLeft+view.width+1;};
   const scroll=d.querySelector('.ainoa-conversation-scroll');
   return {dialog:inside(d),input:inside(document.querySelector('#creative-story')),send:inside(document.querySelector('#creative-analyze')),header:inside(d.querySelector('header')),scrollHeight:scroll.clientHeight,overflow:d.scrollWidth>d.clientWidth+1,font:parseFloat(getComputedStyle(document.querySelector('#creative-story')).fontSize),height:box.height};
  });
  assert(result.dialog&&result.input&&result.send&&result.header,JSON.stringify({state,result}));
  assert(!result.overflow&&result.scrollHeight>=32,JSON.stringify({state,result}));
  assert(result.font>=16);assert.equal(await field.inputValue(),original,'Viewport changes retain input');
  await page.screenshot({path:`${output}/simulated-${state.name}-${width}.png`});
 }
 // Layout-resizing browsers and old WebViews without VisualViewport use innerHeight.
 await page.getByRole('button',{name:'AInoa 대화 닫기',exact:true}).click();
 await page.evaluate(()=>{window.testView=window.visualViewport;Object.defineProperty(window,'visualViewport',{configurable:true,value:null});});
 await page.setViewportSize({width,height:360});await page.locator('#creative-chat').click();
 await page.waitForSelector('#ainoa-conversation[open]');
 assert(await page.locator('#ainoa-conversation').evaluate(d=>{const r=d.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}));
 await page.getByRole('button',{name:'AInoa 대화 닫기',exact:true}).click();
 await page.evaluate(()=>Object.defineProperty(window,'visualViewport',{configurable:true,value:window.testView}));
 await page.setViewportSize({width,height:900});await page.locator('#creative-chat').click();
 await page.waitForSelector('#ainoa-conversation[open]');
}
