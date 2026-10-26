import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';

// Run the actual PHP page's browser bootstrap with the operating public SQL rows.
// Only account data and external YouTube transport are fixtures; no login bypass.
const base='https://noastudio.ai.kr',out='preview-proof',phase=process.env.NOA_PREVIEW_PHASE||'candidate';
const audit=JSON.parse(readFileSync(out+'/catalog.json','utf8')),rows=audit.rows;
const source=readFileSync(out+'/youtube-bootstrap.js','utf8');
assert(source.includes('<?=json_encode($browseRows,'));
const bootstrap=source.replace(/<\?=json_encode\(\$browseRows,[\s\S]*?\?>/,()=>JSON.stringify(rows).replaceAll('<','\\u003c'));
assert(!bootstrap.includes('<?'));
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const originals=[['dreamy-deep-house',11],['kpop-original',11],['thai-original',10]].map(([genre,ep])=>{
 const r=rows.find(r=>r.genre===genre&&Number(r.ep)===ep&&r.video&&r.preferredVideo);assert(r);return r;
});
assert(rows.some(r=>r.title===originals[0].title&&r.genre!==originals[0].genre),'cross-genre title collision exists in the test catalog');
const saved=audit.order.playlists.find(p=>p.group==='cover'&&p.keys.length);
const cover=rows.find(r=>saved.keys.includes(r.orderKey)&&r.video&&!r.customPlaylistId);assert(cover);
const cases=[];
for(const width of [390,1280])for(const theme of ['noa-studio','noa-ivory'])for(const item of originals)cases.push({width,theme,item,play:true});
cases.push({width:390,theme:'noa-studio',item:cover,play:true,playlist:saved});
cases.push({width:390,theme:'noa-ivory',item:originals[0],play:false,legacyQuery:'&view=all&type=video&page=2'});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']}),results=[];
try{
 for(const test of cases){
  const {width,theme,item,play,playlist}=test,act=Math.ceil(Number(item.ep)/10)||0;
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'}),page=await context.newPage(),errors=[],embeds=[];
  page.on('pageerror',e=>errors.push(e.message));
  const rawRows=[...new Map(rows.map(r=>[r.key,r])).values()];
  const html='<!doctype html><html lang="ko" data-noa-precision="ios" data-noa-theme="'+theme+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-youtube.css"><link rel="stylesheet" href="/noa-account.css"><style>[hidden]{display:none!important}</style>'+['noa-browse.js','noa-youtube.js','noa-account.js'].map(f=>'<script src="/'+f+'?position='+phase+'" defer></script>').join('')+'</head><body class="noa-page"><main><p class="noa-eyebrow">NOA STUDIO / WATCH & GROW</p><h1>YouTube</h1><p>음악에 장면을 더하고, 다음 이야기를 발견하세요.</p><section id="yt-player" class="lab-panel" hidden><h2 id="yt-playing"></h2><iframe id="yt-frame" title="NOA STUDIO 공식 YouTube 플레이어" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe><div id="yt-coming-preview" hidden><img id="yt-coming-art"></div><div class="noa-media-details"><details id="youtube-description"><summary>설명 펼치기</summary><pre id="youtube-description-text"></pre><a id="youtube-original">YouTube 원본</a></details><details id="youtube-lyrics"><summary>가사 펼치기</summary><pre id="youtube-lyrics-text"></pre></details></div></section><section id="youtube-browse" class="noa-browse" data-noa-browse-boot></section><label class="noa-video-search">전체 영상 검색<input id="youtube-search" type="search"></label><div class="yt-grid" id="yt-videos" hidden>'+rawRows.map(r=>'<article class="yt-card" data-browse-key="'+esc(r.key)+'"><button class="yt-watch" '+(r.video?'data-video="'+esc(r.video)+'"':'data-coming-key="'+esc(r.key)+'" data-coming-art="'+esc(r.thumb)+'"')+' data-title="'+esc(r.title)+'">재생</button><h2>'+esc(r.title)+'</h2></article>').join('')+'</div></main><script>'+bootstrap+'</script></body></html>';
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname.endsWith('youtube.com')){embeds.push(u.pathname);return route.fulfill({body:'<!doctype html><html style="background:#101114;color:white"><meta charset="utf-8"><p>YouTube 영상 연결 확인</p></html>',contentType:'text/html'});}
   if(u.origin===base&&u.pathname==='/noa-youtube.php'&&!u.searchParams.has('detail'))return route.fulfill({body:html,contentType:'text/html'});
   if(u.origin===base&&u.pathname==='/noa-category-order.php'){
    // Saved membership arrives after the initial page render, as on production.
    await new Promise(resolve=>setTimeout(resolve,250));return route.fulfill({json:{...audit.order,admin:false,csrf:undefined}});
   }
   if(u.origin===base&&u.pathname==='/noa-bridge/membership.php')return route.fulfill({json:{ok:true,member:true,name:'최고관리자',balance:600,remainingDays:0}});
   if(!['GET','HEAD'].includes(route.request().method()))return route.fulfill({status:204,body:''});
   if(phase==='candidate'&&['noa-browse.js','noa-youtube.js','noa-account.js','noa-account.css'].some(n=>u.pathname==='/'+n))return route.fulfill({path:process.cwd()+'/deploy'+u.pathname,contentType:u.pathname.endsWith('.js')?'application/javascript':'text/css'});
   return route.continue();
  });
  await page.goto(base+'/noa-youtube.php?track='+item.key+(play?'&play=1':'')+(test.legacyQuery||''));
  const focused=page.locator('[data-noa-focus="true"]');await focused.waitFor();
  await page.locator('#noa-account-bar').waitFor();
  if(play)await page.waitForFunction(id=>document.getElementById('yt-frame').src.includes('/embed/'+id),item.video);
  await page.waitForFunction(()=>{const r=document.querySelector('[data-noa-focus]')?.getBoundingClientRect();return r&&r.top>0&&r.bottom<innerHeight;});
  const url=new URL(page.url());assert.equal(url.pathname,'/noa-youtube.php');assert.equal(url.searchParams.get('genre'),item.genre);assert.equal(url.searchParams.get('track'),item.key);assert.equal(url.searchParams.get('view'),null);assert.equal(url.searchParams.get('type'),null);
  assert.equal(await page.locator('#youtube-search').inputValue(),'','recommendation must not trigger title search');
  assert(await page.locator('#yt-videos').isHidden(),'global search grid stays closed');
  assert.equal(await page.locator('[data-browse-level="1"] .noa-browse-card').count(),4,'existing categories remain available');
  assert.equal(await focused.getAttribute('aria-current'),'true');assert.equal(await focused.getAttribute('data-inline-key'),item.key);
  const container=playlist?page.locator('.noa-user-playlist[data-playlist-id="'+playlist.id+'"]'):page.locator('.noa-inline-act[data-act-genre="'+item.genre+'"][data-act-number="'+act+'"]');
  const detail=container.locator(':scope>[data-browse-level="4"]');assert(await detail.isVisible());
  assert.equal(await container.locator(':scope>.noa-collection-tools>.noa-list-toggle').getAttribute('aria-expanded'),'true');
  const keys=await detail.locator('.noa-inline-song').evaluateAll(nodes=>nodes.map(n=>n.dataset.inlineKey));
  const members=keys.map(key=>rows.find(r=>r.key===key&&r.genre===item.genre&&!r.customPlaylistId));assert(members.every(Boolean),'selected list contains only the correct genre');
  if(playlist){
   const positions=members.map(r=>playlist.keys.indexOf(r.orderKey));assert.deepEqual(positions,positions.slice().sort((a,b)=>a-b),'saved playlist order preserved');
  }else{
   assert.equal(url.searchParams.get('act'),String(act));
   const eps=members.map(r=>Number(r.ep));assert(eps.every(ep=>Math.ceil(ep/10)===act));assert.deepEqual(eps,eps.slice().sort((a,b)=>a-b),'EP sequence preserved');assert(eps.length>1,'ACT context includes neighbouring songs');
  }
  if(play){assert(await focused.locator('..').locator('.noa-inline-playback #yt-frame').isVisible());assert.equal(embeds.length,1,'asynchronous order load must not restart playback');}
  else{assert(await page.locator('#yt-player').isHidden());assert.equal(embeds.length,0);}
  const box=await focused.boundingBox(),header=await page.locator('#noa-account-bar').boundingBox();assert(box.y>=header.y+header.height,'focused EP is not obscured by the account bar');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  const file=phase+'-position-'+item.genre+'-'+width+'-'+theme+(play?'':'-no-play');
  await page.screenshot({path:out+'/'+file+'.png'});
  if(item===originals[0]&&play){
   await page.locator('.noa-browse-all').click();assert(await page.locator('#yt-videos').isVisible());
   await page.locator('#youtube-search').fill(item.title);
   const searchKeys=await page.locator('#yt-videos>[data-browse-key]:not([hidden])').evaluateAll(ns=>ns.map(n=>n.dataset.browseKey));
   assert(new Set(searchKeys.map(key=>rows.find(r=>r.key===key)?.genre)).size>1,'explicit title search still works across genres');
  }
  results.push({phase,width,theme,key:item.key,genre:item.genre,act,playlist:playlist?.id||null,ep:item.ep,play,selectedListKeys:keys,focusedPosition:box,existingPage:url.pathname,searchBlank:true,noOverflow:true,errors,pageSourceSha256:audit.youtubePageSha256,catalogData:'operating public SQL projection',pageBootstrap:phase==='live'?'deployed PHP exact-byte verified':'candidate PHP',providerTransport:'fixture',accountData:'fixture'});
  await context.close();
 }
 assert.equal(results.length,14);
}finally{writeFileSync(out+'/'+phase+'-position.json',JSON.stringify(results,null,2));await browser.close();}
console.log('RECOMMENDATION_POSITION_OK',phase,results.length);
