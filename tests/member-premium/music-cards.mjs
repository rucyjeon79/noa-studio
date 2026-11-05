import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const themes=JSON.parse(readFileSync('deploy/noa-design.json','utf8')).themes;
const musicStyles=[...readFileSync('deploy/noa-music.php','utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
const rows=[
 {key:'premium-credit',title:'First Glance',genre:'pop-original',ep:31,thumb:'/cover.jpg',premium:true},
 {key:'premium',title:'작은 떨림',genre:'pop-original',ep:32,thumb:'/cover.jpg',premium:true},
 {key:'standard-credit',title:'마음의 끝자락에서 다시 만나는 아주 긴 노래 제목',genre:'pop-original',ep:33,thumb:'/cover.jpg'},
 {key:'standard',title:'나란히',genre:'pop-original',ep:34,thumb:''}
];
const wav=Buffer.alloc(44+16000*10);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);

// Run the production browse, premium, sleeve, engagement, support and editor renderers.
// Isolated reads (including editor config POST) and silent WAV; no account or financial writes.
export async function verifyMusicCards(browser,out,report){
 for(const width of [320,390,768,1440])for(const theme of themes)for(const admin of [false,true]){
  const context=await browser.newContext({viewport:{width,height:900},locale:'ko-KR',serviceWorkers:'block'});context.setDefaultTimeout(10000);
  const errors=[],writes=[];
  await context.route('**/*',r=>{
   const req=r.request(),u=new URL(req.url()),json=data=>r.fulfill({contentType:'application/json',body:JSON.stringify(data)});
   if(u.origin!=='https://cards.fixture')return r.abort();
   if(u.pathname==='/noa-gpt.php'&&u.searchParams.get('op')==='config'&&req.method()==='POST'){assert.deepEqual(req.postDataJSON(),{});return json({ok:true,worker:false,configured:false});}
   if(req.method()!=='GET'){writes.push(u.pathname);return r.abort();}
   if(u.pathname==='/noa-bridge/engagement.php')return json({ok:true,items:JSON.parse(u.searchParams.get('targets')||'[]').map(t=>({...t,likes:0,comments:0,liked:false,reactionScore:0,score:null}))});
   if(u.pathname==='/noa-bridge/support.php')return json({ok:true,items:JSON.parse(u.searchParams.get('targets')||'[]').map(t=>({...t,count:0,available:true}))});
   if(u.pathname==='/noa-inline-edit.php')return json({ok:true,writeKey:'premium-credit',kind:'single',packageType:'ep',revision:1,context:{genre:'pop-original',ep:'31'},fields:{title:'First Glance',lyrics:'가사',cast:'male'}});
   if(u.pathname==='/tone.wav')return r.fulfill({contentType:'audio/wav',body:wav});
   if(u.pathname==='/cover.jpg')return r.fulfill({contentType:'image/jpeg',body:readFileSync('public/splash/rain-g2-c.jpg')});
   if(/\.(css|js)$/.test(u.pathname)&&existsSync('deploy'+u.pathname))return r.fulfill({contentType:u.pathname.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8',body:readFileSync('deploy'+u.pathname)});
   if(req.resourceType()==='image')return r.fulfill({contentType:'image/jpeg',body:readFileSync('public/splash/rain-g2-c.jpg')});
   return r.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html><body></body></html>'});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('https://cards.fixture/noa-music.php?group=original&genre=pop-original&act=4');
  const tokens=Object.entries(theme.tokens).map(([k,v])=>'--noa-'+k+':'+v).join(';');
  await page.setContent(`<!doctype html><html lang="ko" class="noa-member-ui noa-shell-wide" data-noa-style="starlight" data-noa-precision="1" data-noa-theme="${theme.id}" style="${tokens}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${musicStyles}</style><style>#songs[hidden]{display:none!important}</style>${['noa-music.css','noa-ui.css','noa-policy-20261024.css','noa-starlight.css','noa-listening.css','noa-engagement.css','noa-support.css','noa-music-vinyl.css','noa-member-surfaces.css'].map(f=>'<link rel="stylesheet" href="/'+f+'">').join('')}</head><body class="noa-page noa-sound-page"><main><section id="music-browse"></section><div id="songs" hidden>${rows.map(r=>'<article class="song" data-key="'+r.key+'" data-jukebox-key="'+r.key+'" data-title="'+r.title+'" data-audio="/tone.wav" data-audio-sha="'+(r.premium?'verified':'')+'"><button class="song-select"><span class="info"><strong>'+r.title+'</strong></span></button><div class="jukebox-actions"><button class="sound-play"></button><button class="jukebox-download"></button></div></article>').join('')}</div><audio id="sound-player" src="/tone.wav" loop></audio><div hidden><img id="dock-cover"><span id="dock-cover-empty">♫</span></div></main><script type="application/json" id="noa-engagement-context">{"member":true}</script><script type="application/json" id="noa-original-titles">{"31":"사랑이 스며든 날","32":"작은 떨림","33":"마음결","34":"나란히"}</script></body></html>`);
  await page.addScriptTag({content:'const records='+JSON.stringify(rows)+',collections=[];window.playCalls=[];window.addCalls=[];window.downloadCalls=[];window.addEventListener("noa-playlist-add",e=>addCalls.push(e.detail.key));document.querySelectorAll("#songs .jukebox-download").forEach(b=>b.onclick=()=>downloadCalls.push(b.closest(".song").dataset.key));'});
  await page.addScriptTag({url:'/noa-browse.js'});
  await page.evaluate(()=>{
   const tree=NoaBrowse.mount({host:document.querySelector('#music-browse'),rows:records,onChange:()=>tree.apply([]),onSelect:r=>{playCalls.push(r.key);window.dispatchEvent(new CustomEvent('noa-track-selected',{detail:{record:r}}));document.querySelector('#sound-player').play();}});tree.apply([]);
  });
  for(const file of ['noa-premium.js','noa-music-vinyl.js','noa-engagement.js','noa-support.js'])await page.addScriptTag({url:'/'+file});
  if(admin){await page.addScriptTag({url:'/noa-browse-edit.js'});await page.evaluate(()=>NoaBrowseEdit.mount({host:document.querySelector('#music-browse'),rows:records}));}
  try{
   const list=page.locator('.noa-inline-songs').first();await list.locator('.lp-track-jacket').first().waitFor();await list.locator('.noa-support-button:not(:disabled)').first().waitFor();
   assert.equal(await list.locator('.noa-inline-song-row').count(),4);assert.equal(await list.locator('.noa-premium-badge').count(),2);assert.equal(await list.locator('.noa-original-title').count(),2);
   for(const mode of ['list','album']){
    await page.locator('.lp-view-switch [data-mode='+mode+']').first().click();await page.waitForFunction(mode=>document.querySelector('.noa-inline-songs')?.dataset.trackView===mode,mode);
    await list.evaluate(async list=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await Promise.all(list.getAnimations({subtree:true}).filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
    const geometry=await list.evaluate(list=>{
     const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
     const lum=c=>{const rgb=c.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>(v/=255)<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
     return {overflow:document.documentElement.scrollWidth>innerWidth+1,cards:[...list.querySelectorAll('.noa-inline-song-row')].map(e=>{
      const s=getComputedStyle(e),credit=e.querySelector('.noa-original-title'),c=credit&&getComputedStyle(credit),contrast=c?(Math.max(lum(c.color),lum(c.backgroundColor))+.05)/(Math.min(lum(c.color),lum(c.backgroundColor))+.05):null;
      return {key:e.dataset.inlineKey,card:box(e),cover:box(e.querySelector('.lp-track-jacket')),art:box(e.querySelector('.lp-track-art')),title:box(e.querySelector('.noa-inline-title')),name:box(e.querySelector('.noa-track-name')),genre:box(e.querySelector('.noa-track-genre')),credit:credit&&box(credit),play:box(e.querySelector('.lp-cover-toggle')),reactions:[...e.querySelectorAll('.noa-engagement>button')].map(box),tools:[...e.querySelectorAll('.noa-direct-action')].map(box),badge:e.querySelector('.noa-premium-badge')&&box(e.querySelector('.noa-premium-badge')),background:s.backgroundImage,border:s.borderColor,radius:s.borderRadius,decoration:getComputedStyle(e,'::before').content,contrast};
     })};
    });
    assert(!geometry.overflow,JSON.stringify({width,theme:theme.id,admin,mode,geometry}));
    const overlap=(a,b)=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>.5;
    for(const c of geometry.cards){
     const note=JSON.stringify({width,theme:theme.id,admin,mode,c});
     assert(Math.abs(c.cover.w-c.cover.h)<1,note);assert(Math.abs((c.play.x+c.play.right-c.cover.x-c.cover.right)/2)<1,note);assert(Math.abs((c.play.y+c.play.bottom-c.cover.y-c.cover.bottom)/2)<1,note);
     assert(Math.abs(c.name.x-c.genre.x)<1,note);assert(c.genre.y>=c.name.bottom-1,note);assert.equal(c.tools.length,admin?3:2,note);assert.equal(c.reactions.length,3,note);
     for(const control of [c.play,...c.tools,...c.reactions])assert(control.w>=43.5&&control.h>=43.5&&control.x>=c.card.x-.5&&control.right<=c.card.right+.5&&control.y>=c.card.y-.5&&control.bottom<=c.card.bottom+.5,note);
     const controls=[...c.tools,...c.reactions];for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++)assert(!overlap(controls[i],controls[j]),note);
     for(const tool of c.tools){assert(!overlap(tool,c.title)&&!overlap(tool,c.cover),note);if(c.badge)assert(!overlap(tool,c.badge),note);}
     assert(c.reactions[0].y>=c.title.bottom-1,note);
     if(c.credit){assert(Math.abs(c.credit.x-c.name.x)<1&&c.credit.y>=c.genre.bottom-1,note);assert(c.contrast>=4.5,note);}
     if(mode==='list'){
      assert(c.radius==='12px',note);assert(c.card.h-c.title.h-c.reactions[0].h<=63,note);assert(c.title.x-c.art.right>=11&&c.title.x-c.art.right<=13,note);assert(c.reactions[0].y-c.title.bottom<=5,note);
      assert(c.card.bottom-c.reactions[0].bottom>=11&&c.card.bottom-c.reactions[0].bottom<=14,note);
      if(c.badge){assert(c.background.includes('linear-gradient'),note);assert.notEqual(c.decoration,'none',note);assert.notEqual(c.border,geometry.cards[3].border,note);assert(c.badge.bottom<=c.title.y,note);}
     }else{assert(c.title.y>=c.cover.bottom-1,note);assert(c.tools[0].y>=c.reactions[0].bottom-1,note);}
    }
    if([320,390,1440].includes(width)&&admin)await list.screenshot({path:out+'/cards-'+mode+'-'+width+'-'+theme.id+'.jpg',type:'jpeg',quality:90});
    const first=list.locator('.noa-inline-song-row').first();await first.locator('.lp-cover-toggle').click();await first.locator('.lp-running').waitFor();
    const playing=await first.locator('.lp-track-jacket').boundingBox();assert.equal(Math.round(playing.width),Math.round(geometry.cards[0].cover.w),'playback must not resize the cover');
    if(width===390&&admin)await list.screenshot({path:out+'/cards-playing-'+mode+'-'+theme.id+'.jpg',type:'jpeg',quality:90});
    await first.locator('.lp-cover-toggle').click();await page.waitForFunction(()=>document.querySelector('#sound-player').paused);await first.locator('.lp-running').waitFor({state:'detached'});
    await first.locator('.noa-song-action[aria-label$=" 담기"]').click();await first.locator('.noa-song-action[aria-label$=" 다운로드"]').click();
    assert.equal(await page.evaluate(()=>addCalls.at(-1)),'premium-credit');assert.equal(await page.evaluate(()=>downloadCalls.at(-1)),'premium-credit');
    report.fixtures.push({key:'music-cards',width,theme:theme.id,admin,mode,geometry,nativeActions:true,playPause:true});
   }
   if(admin){await list.locator('.noa-edit-edit').first().click();await page.locator('.noa-edit-form').first().waitFor();assert(await page.locator('.noa-edit-form').first().isVisible());}
   await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await list.locator('.lp-spindle').first().evaluate(e=>getComputedStyle(e).animationName),'none');
   assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  }catch(error){await page.screenshot({path:out+'/cards-failure-'+width+'-'+theme.id+'-'+admin+'.png',fullPage:true});throw error;}finally{await context.close();}
 }
 console.log('MEMBER_PRODUCTION_MUSIC_CARDS_32_LAYOUTS_AND_PLAYBACK_OK');
}
