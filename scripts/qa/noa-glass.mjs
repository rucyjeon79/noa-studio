import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const sizes=[{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:768,height:1024},{width:1024,height:768},{width:1280,height:900},{width:1920,height:1080},{width:844,height:390},{width:568,height:320}];
const themes=['noa-studio','noa-ivory'];
function luminance(hex){const rgb=hex.match(/[a-f\d]{2}/gi).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
function contrast(a,b){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export async function verifyGlass({context,phase,base,out,report,auditPrecision}){
 const samples=[],states=[];
 const page=await context.newPage();
 for(const route of ['/','/noa-music.php','/noa-settings.php','/bbs/login.php']){
  await page.goto(base+route,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.NoaGlass&&window.NoaUI?.getState()&&document.fonts.status==='loaded');
  if(route==='/')await page.waitForFunction(()=>document.body.dataset.noaHomeReady==='true');
  if(route==='/noa-music.php'){
   // Existing public player chrome and owner-only action shapes, isolated in browser memory.
   await page.locator('.noa-transport').evaluate(p=>p.hidden=false);
   await page.evaluate(()=>{
    const host=document.createElement('section');host.id='glass-action-fixture';host.className='jukebox-actions';host.setAttribute('aria-label','버튼 표면 검증 전용');
    const original=document.querySelector('.sound-play');if(!original)throw Error('Real source play control missing');
    for(const type of ['sound-play','sound-upload','jukebox-replace','jukebox-download','jukebox-busy','jukebox-busy sound-upload']){const b=original.cloneNode(true);b.className=type+' noa-icon-button';b.id='glass-fixture-'+type;b.type='button';b.setAttribute('aria-label',type);if(type==='jukebox-busy')b.disabled=true;host.append(b);}
    document.querySelector('main').prepend(host);window.NoaGlass.refresh(host);
   });
  }
  for(const theme of themes){
   await page.evaluate(theme=>window.NoaUI.apply({...window.NoaUI.getState(),theme}),theme);
   for(const size of sizes){
    await page.setViewportSize(size);await page.evaluate(()=>{window.NoaCardLayout.refresh();window.NoaGlass.refresh();});
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const result=await page.evaluate(()=>{
     const visible=e=>e.getBoundingClientRect().width>0&&getComputedStyle(e).display!=='none';
     const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
     const nodes=[...document.querySelectorAll('.noa-glass-control')].filter(visible).map(b=>{
      const s=getComputedStyle(b),after=getComputedStyle(b,'::after'),box=rect(b),svg=b.querySelector('svg');
      return{id:b.id||b.className,box,background:s.backgroundImage,shadow:s.boxShadow,color:s.color,filter:s.filter,backdrop:s.backdropFilter,animation:s.animationName,willChange:s.willChange,label:b.dataset.noaGlassLabel,after:after.content,align:s.alignItems,justify:s.justifyContent,direction:s.flexDirection,textAlign:s.textAlign,scrollWidth:b.scrollWidth,clientWidth:b.clientWidth,scrollHeight:b.scrollHeight,clientHeight:b.clientHeight,icon:svg?rect(svg):null};
     });
     const root=getComputedStyle(document.documentElement);return{viewport:innerWidth,scroll:document.documentElement.scrollWidth,theme:document.documentElement.dataset.noaTheme,base:root.getPropertyValue('--noa-glass-base').trim(),crown:root.getPropertyValue('--noa-glass-crown').trim(),shade:root.getPropertyValue('--noa-glass-shade').trim(),text:root.getPropertyValue('--noa-text').trim(),accent:root.getPropertyValue('--noa-glass-icon').trim(),nodes};
    });
    assert(result.nodes.length>0,'no selected glass actions '+route);assert(result.scroll<=result.viewport+1,'glass overflow '+route);
    for(const b of result.nodes){
     assert(b.background.includes('radial-gradient'),'flat action '+b.id);assert(b.shadow.includes('inset'),'missing sculpted depth '+b.id);
     assert.equal(b.filter,'none');assert.equal(b.backdrop,'none');assert.equal(b.animation,'none');assert.equal(b.willChange,'auto');
     assert(b.box.width>=44&&b.box.height>=44,'small glass touch area '+b.id);
     assert(b.box.x>=-1&&b.box.right<=result.viewport+1,'glass control clipped '+b.id);
     if(b.label){assert.equal(b.direction,'column');assert.equal(b.align,'center');assert.equal(b.justify,'center');assert.equal(b.textAlign,'center');assert.equal(b.after,JSON.stringify(b.label));assert(b.scrollWidth<=b.clientWidth+1&&b.scrollHeight<=b.clientHeight+1,'glass label clipped '+b.id);if(b.icon)assert(Math.abs((b.icon.x+b.icon.width/2)-(b.box.x+b.box.width/2))<=1,'glass icon center '+b.id);}
    }
    const textContrast=Math.min(...[result.base,result.crown,result.shade].map(c=>contrast(result.text,c)));
    const iconContrast=Math.min(...[result.base,result.crown,result.shade].map(c=>contrast(result.accent,c)));
    assert(textContrast>=4.5,'glass label contrast '+theme);assert(iconContrast>=3,'glass icon contrast '+theme);
    const precision=await auditPrecision(page);samples.push({route,theme,...size,textContrast,iconContrast,buttons:result.nodes.length,precision});
    if([390,844,1280].includes(size.width)&&['/','/noa-music.php','/bbs/login.php'].includes(route))await page.screenshot({path:path.join(out,'glass-'+theme+'-'+route.replace(/[^a-z0-9]/gi,'-')+'-'+size.width+'.jpg'),type:'jpeg',quality:86});
   }
  }
 }
 // Selected, native-disabled, custom-disabled, press, keyboard focus and reduced motion.
 await page.goto(base+'/noa-music.php',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.NoaGlass&&window.NoaUI?.getState());
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{
  const original=document.querySelector('.sound-play');const host=document.createElement('div');host.id='glass-states-fixture';host.className='controls';
  for(const [id,attr]of [['normal',null],['selected','aria-pressed'],['disabled','disabled'],['aria-disabled','aria-disabled']]){const b=original.cloneNode(true);b.className='sound-play';b.id='glass-state-'+id;b.type='button';if(attr)b.setAttribute(attr,'true');b.onclick=()=>{b.dataset.calls=String(Number(b.dataset.calls||0)+1);};host.append(b);}
  document.querySelector('main').prepend(host);window.NoaGlass.refresh(host);
 });
 await page.waitForFunction(()=>document.querySelector('#glass-state-normal').classList.contains('noa-glass-control'));
 for(const theme of themes){
  await page.evaluate(theme=>window.NoaUI.apply({...window.NoaUI.getState(),theme}),theme);
  const normal=page.locator('#glass-state-normal');await normal.press('Tab');await normal.focus();
  const focus=await normal.evaluate(b=>({width:getComputedStyle(b).outlineWidth,style:getComputedStyle(b).outlineStyle}));assert.equal(focus.style,'solid');assert.equal(focus.width,'2px');
  const borders=await page.locator('#glass-states-fixture button').evaluateAll(bs=>bs.map(b=>({id:b.id,border:getComputedStyle(b).borderColor,opacity:getComputedStyle(b).opacity})));assert.notEqual(borders[0].border,borders[1].border);assert(Number(borders[2].opacity)<1);
  await normal.press('Enter');assert.equal(await normal.getAttribute('data-calls'),theme===themes[0]?'1':'2');
  await page.locator('#glass-state-aria-disabled').click();assert.equal(await page.locator('#glass-state-aria-disabled').getAttribute('data-calls'),null);
  await page.locator('#glass-state-disabled').evaluate(b=>b.click());assert.equal(await page.locator('#glass-state-disabled').getAttribute('data-calls'),null);
  await page.emulateMedia({reducedMotion:'no-preference'});await normal.dispatchEvent('mousedown');
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await normal.evaluate(b=>getComputedStyle(b).transitionDuration),'0s');
  states.push({theme,keyboardActionOnce:true,nativeDisabledInert:true,ariaDisabledInert:true,focusOutlinePx:2,reducedMotion:true});
 }
 // No persistent animation, image layer, blur or compositing hint is introduced by the material.
 const performance=await page.evaluate(()=>{const host=document.getElementById('glass-states-fixture');const start=performance.now();for(let i=0;i<100;i++)window.NoaGlass.refresh(host);return{schedule100Ms:performance.now()-start};});assert(performance.schedule100Ms<200);
 await page.close();
 if(phase==='candidate'){
  const admin=await context.newPage();for(const route of ['/noa-my-admin-fixture','/noa-ai-lab-admin-fixture']){
   await admin.goto(base+route);await admin.waitForFunction(()=>window.NoaGlass&&window.NoaUI?.getState());
   for(const theme of themes){await admin.evaluate(theme=>window.NoaUI.apply({...window.NoaUI.getState(),theme}),theme);for(const size of sizes){await admin.setViewportSize(size);await admin.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert(await admin.locator('.noa-glass-control').count()>0);assert(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));samples.push({route,theme,...size,adminTemplate:true});if(size.width===390||size.width===1280)await admin.screenshot({path:path.join(out,'glass-admin-'+route.replace(/[^a-z0-9]/gi,'-')+'-'+theme+'-'+size.width+'.jpg'),type:'jpeg',quality:84});}}
  }await admin.close();
 }
 await fs.writeFile(path.join(out,'glass-report.json'),JSON.stringify({ok:true,phase,material:'Semi-Gloss Sculpted Glass',sheenToken:.55,themeDeviceSamples:samples,states,performance,ownerOnlyActions:'isolated browser-memory shape fixtures; no upload or download requests',newImages:0,continuousAnimation:false,blur:false},null,2));
 report.push({phase,glassThemeDeviceSamples:samples.length,glassStateThemes:states.length,newImages:0,continuousAnimation:false});
}
