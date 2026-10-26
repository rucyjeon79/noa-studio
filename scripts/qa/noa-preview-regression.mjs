import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const base='https://noastudio.ai.kr',out='preview-proof',phase=process.env.NOA_PREVIEW_PHASE||'diagnose';mkdirSync(out,{recursive:true});
const catalog=JSON.parse(readFileSync(out+'/catalog.json','utf8')).rows;
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']}),results=[];
try{
 for(const width of [390,1280])for(const genre of ['your-story','cover-reborn','kpop-original']){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'}),page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  const sourceRows=catalog.filter(r=>r.genre===genre), group=genre==='your-story'?'story':genre==='cover-reborn'?'cover':'original';
  const html='<!doctype html><html lang="ko" data-noa-precision="ios" data-noa-theme="noa-studio"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-youtube.css"><link rel="stylesheet" href="/noa-account.css"><style>[hidden]{display:none!important}main{padding-top:24px}</style></head><body class="noa-page"><main><h1>YouTube</h1><section id="youtube-browse"></section><input id="youtube-search" type="search"><section id="yt-player" hidden><h2 id="yt-playing"></h2><iframe id="yt-frame" title="NOA STUDIO 공식 YouTube 플레이어" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe><div id="yt-coming-preview" hidden><img id="yt-coming-art"></div><div class="noa-media-details"><details id="youtube-description"><summary>설명 펼치기</summary><pre id="youtube-description-text"></pre><a id="youtube-original">YouTube 원본</a></details><details id="youtube-lyrics"><summary>가사 펼치기</summary><pre id="youtube-lyrics-text"></pre></details></div></section><div id="yt-videos" hidden>'+sourceRows.map(r=>'<article class="yt-card" data-browse-key="'+esc(r.key)+'"><button class="yt-watch" '+(r.video?'data-video="'+esc(r.video)+'"':'data-coming-key="'+esc(r.key)+'" data-coming-art="'+esc(r.thumb)+'"')+' data-title="'+esc(r.title)+'">재생</button><h2>'+esc(r.title)+'</h2></article>').join('')+'</div></main></body></html>';
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname.endsWith('youtube.com')){requests.push(u.pathname);return route.fulfill({body:'<!doctype html><p>External player transport fixture</p>',contentType:'text/html'});}
   if(u.origin===base&&u.pathname==='/noa-preview-fixture')return route.fulfill({body:html,contentType:'text/html'});
   if(u.origin===base&&u.pathname==='/noa-category-order.php')return route.fulfill({json:{admin:true,csrf:'fixture',revision:1,story:[],cover:[],playlists:[]}});
   if(u.origin===base&&u.pathname==='/noa-bridge/membership.php')return route.fulfill({json:{ok:true,member:true,name:'최고관리자',balance:600,remainingDays:0}});
   if(u.origin===base&&u.pathname==='/noa-inline-edit.php')return route.fulfill({status:403,json:{ok:false}});
   if(!['GET','HEAD'].includes(route.request().method()))return route.fulfill({status:204,body:''});
   if(phase==='candidate'&&['noa-browse.js','noa-account.js','noa-account.css','noa-youtube.js'].some(n=>u.pathname==='/'+n))return route.fulfill({path:process.cwd()+'/deploy'+u.pathname,contentType:u.pathname.endsWith('.js')?'application/javascript':'text/css'});
   return route.continue();
  });
  await page.goto(base+'/noa-preview-fixture?genre='+genre);
  for(const file of ['noa-browse-edit.js','noa-browse-order.js','noa-browse.js','noa-youtube.js','noa-account.js']){const code=phase==='candidate'?readFileSync('deploy/'+file,'utf8'):await(await context.request.get(base+'/'+file+'?qa='+Date.now())).text();await page.addScriptTag({content:code});}
  await page.evaluate(rows=>{let browse;const cards=[...document.querySelectorAll('[data-browse-key]')],render=()=>{if(!browse)return;const view=browse.apply(rows),keys=new Set(view.visible.map(r=>r.key));for(const c of cards)c.hidden=!keys.has(c.dataset.browseKey);document.getElementById('yt-videos').append(...view.visible.map(r=>cards.find(c=>c.dataset.browseKey===r.key)).filter(Boolean));document.getElementById('yt-videos').hidden=view.stage!=='songs';};browse=window.NoaBrowse.mount({host:document.getElementById('youtube-browse'),rows,onChange:render,search:document.getElementById('youtube-search'),kind:'영상'});render();},sourceRows);
  await page.locator('.noa-edit-edit').first().waitFor();
  const item=sourceRows.find(r=>r.video&&r.kind!=='playlist'&&!r.comingSoon);assert(item);
  const row=page.locator('.noa-inline-song[data-inline-key="'+item.key+'"]');if(!await row.isVisible())await page.locator('.noa-inline-act').filter({has:row}).locator('.noa-list-toggle').click();
  await row.click();await page.waitForTimeout(200);
  const detail=await page.evaluate(()=>{const f=document.getElementById('yt-frame'),p=document.getElementById('yt-player');return{src:f.getAttribute('src'),parent:p.parentElement?.className,rect:f.getBoundingClientRect().toJSON(),visible:!!f.getBoundingClientRect().height&&!f.closest('[hidden]')};});
  const result={phase,width,genre,key:item.key,title:item.title,...detail,errors,requests};results.push(result);await page.screenshot({path:out+'/'+phase+'-'+genre+'-'+width+'.png'});
  if(phase!=='diagnose'){assert(detail.src?.includes('/embed/'+item.video));assert(detail.visible);assert(detail.rect.width>=width*(width<800?.65:.3));assert.deepEqual(errors,[]);assert.equal(await page.locator('#noa-account-bar a[href="/bbs/logout.php?url=%2F"]').count(),1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  await context.close();
 }
}finally{writeFileSync(out+'/'+phase+'.json',JSON.stringify(results,null,2));await browser.close();}
console.log('PREVIEW_BROWSER',JSON.stringify(results));
