import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync} from 'node:fs';
const rows=['kpop-original','groovy-airy-pop','your-story','cover-reborn','groovy-airy-pop','groovy-airy-pop'].map((genre,i)=>({key:'abcdefghij'+i,video:'abcdefghij'+i,title:['노아의 오리지널송','EP.01 첫 만남','별무리가 보내온 이야기','노아의 커버 무대','EP.02 작은 떨림','EP.11 새로운 장'][i],genre,ep:[0,1,0,0,2,11][i],kind:'video'}));
const markup='<!doctype html><html lang="ko" data-noa-style="starlight"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-starlight.css"><link rel="stylesheet" href="/noa-cinema.css"><body class="noa-page"><main><h1>YouTube</h1><section id="yt-player" hidden><nav id="video-classification"></nav><h2 id="yt-playing"></h2><iframe id="yt-frame" allow="autoplay" title="YouTube"></iframe><div class="noa-media-details"><details id="youtube-description"><pre id="youtube-description-text"></pre></details><details id="youtube-lyrics"><pre id="youtube-lyrics-text"></pre></details><a id="youtube-original"></a></div></section><section id="youtube-browse"></section><div id="yt-videos" hidden>'+rows.map(r=>'<article data-browse-key="'+r.key+'"><button data-video="'+r.video+'" data-title="'+r.title+'">재생</button></article>').join('')+'</div></main><script src="/noa-browse.js"></script><script src="/noa-youtube.js"></script><script src="/noa-cinema.js"></script><script>const rows='+JSON.stringify(rows)+'; const browse=NoaBrowse.mount({host:document.querySelector("#youtube-browse"),rows,kind:"영상",onChange:()=>browse.apply(rows)});browse.apply(rows);</script></body></html>';
mkdirSync('cinema-proof',{recursive:true});const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
try{for(const width of [320,390,1280]){
 const p=await browser.newPage({viewport:{width,height:880}}),errors=[];p.on('pageerror',e=>errors.push(e.message));let switches=0;
 await p.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.hostname==='www.youtube.com'){
   if(u.pathname==='/iframe_api')return route.fulfill({contentType:'application/javascript',body:'window.YT={Player:class{constructor(frame,{events}){window.currentEvents=events;events.onReady({target:{getPlayerState:()=>-1}});}destroy(){}}};window.onYouTubeIframeAPIReady();'});
   switches++;return route.fulfill({contentType:'text/html',body:'<!doctype html><title>테스트 영상</title><span id="video-surface">테스트 영상</span>'});
  }
  if(u.pathname==='/noa-bridge/youtube-thumbnail.php'){
   const art=['starlight-studio','world-journey','fans-stars','act-1','act-2','act-3'][Number(u.searchParams.get('id').slice(-1))];
   return route.fulfill({contentType:'image/webp',body:readFileSync('deploy/noa-assets/editorial/'+art+'.webp')});
  }
  if(u.searchParams.has('detail'))return route.fulfill({json:{ok:true,videoId:u.searchParams.get('detail'),description:'별무리가 보내온 가족의 사연으로 완성한 음악입니다.'}});
  if(u.pathname==='/')return route.fulfill({contentType:'text/html;charset=utf-8',body:markup});
  if(/^\/noa-[\w-]+\.(js|css)$/.test(u.pathname))return route.fulfill({contentType:u.pathname.endsWith('js')?'application/javascript;charset=utf-8':'text/css;charset=utf-8',body:readFileSync('deploy'+u.pathname)});
  return route.fulfill({status:404,body:''});
 });
 await p.goto('https://noastudio.ai.kr/');const cards=p.locator('.cinema-programme');await cards.first().waitFor();assert.equal(await cards.count(),4);assert.equal(switches,0);
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await p.locator('.cinema-feature').screenshot({path:'cinema-proof/feature-'+width+'.png'});await cards.first().locator('..').screenshot({path:'cinema-proof/programmes-'+width+'.png'});
 const hero=p.locator('.cinema-feature .cinema-poster');await hero.click();assert.equal(await p.locator('.cinema-feature #yt-frame').count(),1);
 const epPoster=cards.nth(1).locator('.cinema-poster');
 await p.waitForFunction(()=>!!window.currentEvents);
 await p.frameLocator('#yt-frame').locator('#video-surface').waitFor();
 await p.evaluate(()=>document.fonts.ready);
 await epPoster.evaluate(el=>el.scrollIntoView({behavior:'instant',block:'center'}));
 const before=await epPoster.evaluate(el=>{const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return [x,y,scrollY,document.elementFromPoint(x,y)?.outerHTML.slice(0,120)];});
 await p.evaluate(()=>{window.clickTrace=[];for(const type of ['pointerdown','pointerup','click'])document.addEventListener(type,e=>window.clickTrace.push([type,e.clientX,e.clientY,e.target.outerHTML.slice(0,85)]),true);});

 await epPoster.click();
 if(!await cards.nth(1).locator('#yt-frame').count())console.log('POSTER_TRACE',width,before,await p.evaluate(()=>[scrollY,window.clickTrace,document.activeElement.tagName]));
 await cards.nth(1).locator('#yt-frame').waitFor({timeout:4000});await p.waitForFunction(()=>window.currentEvents&&document.querySelector('#yt-frame').src.includes('abcdefghij1'));
 await p.evaluate(()=>window.currentEvents.onStateChange({data:1}));assert.equal(await p.locator('.cinema-badge').innerText(),'상영 중');
 await p.evaluate(()=>window.currentEvents.onStateChange({data:2}));assert.equal(await p.locator('.cinema-badge').innerText(),'일시정지');
 await p.locator('.cinema-next').click();assert((await p.locator('#yt-frame').getAttribute('src')).includes(rows[4].video));assert(await p.locator('.cinema-next').isHidden());
 await p.evaluate(()=>window.dispatchEvent(new Event('noa-background')));assert(await p.locator('#yt-player').isHidden());assert.equal(await p.locator('#yt-frame').count(),1);
 await cards.first().locator('.cinema-directory').click();await p.locator('[data-browse-level="2"]').waitFor();assert.deepEqual(errors,[]);await p.close();
}console.log('CINEMA_POSTERS_INLINE_STATE_NEXT_EP_AND_NAVIGATION_OK');}finally{await browser.close();}
