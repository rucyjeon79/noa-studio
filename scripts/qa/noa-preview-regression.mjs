import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const base='https://noastudio.ai.kr',out='preview-proof',phase=process.env.NOA_PREVIEW_PHASE||'candidate';mkdirSync(out,{recursive:true});
const audit=JSON.parse(readFileSync(out+'/catalog.json','utf8')),catalog=audit.rows;
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']}),results=[];
try{
 for(const width of [320,390,1280])for(const theme of ['noa-studio','noa-ivory'])for(const genre of ['your-story','cover-reborn','kpop-original']){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'}),page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  const sourceRows=catalog.filter(r=>r.genre===genre),group=genre==='your-story'?'story':genre==='cover-reborn'?'cover':'original';
  const item=sourceRows.find(r=>r.video&&r.kind!=='playlist'&&!r.comingSoon);assert(item);
  const order={...audit.order,admin:true,csrf:'fixture',playlists:[...(audit.order.playlists||[])]};
  // A disposable collection tests both story and cover even when only one has operating collections.
  const fixtureId='ffffffffffffffffffffffff';
  if(group!=='original'){
   order.playlists.push({id:fixtureId,title:'미리보기 검증 모음',group,keys:[item.orderKey||item.key]});
   sourceRows.push({...item,kind:'playlist',act:'',ep:'',orderKey:'playlist:custom:'+fixtureId,musicKey:'playlist:custom:'+fixtureId,customPlaylistId:fixtureId,title:'미리보기 검증 모음'});
  }
  let account={ok:true,member:true,name:width===320?'이름이 긴 회원의 계정':'최고관리자',balance:width===320?12345678:600,remainingDays:30,grant:{status:'active'}};
  const rawRows=[...new Map(sourceRows.map(r=>[r.key,r])).values()];
  const html='<!doctype html><html lang="ko" data-noa-precision="ios" data-noa-theme="'+theme+'"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-youtube.css"><link rel="stylesheet" href="/noa-account.css"><style>[hidden]{display:none!important}main{padding-top:24px}</style></head><body class="noa-page"><main><h1>YouTube</h1><section id="youtube-browse"></section><input id="youtube-search" type="search"><section id="yt-player" hidden><h2 id="yt-playing"></h2><iframe id="yt-frame" title="NOA STUDIO 공식 YouTube 플레이어" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe><div id="yt-coming-preview" hidden><img id="yt-coming-art"></div><div class="noa-media-details"><details id="youtube-description"><summary>설명 펼치기</summary><pre id="youtube-description-text"></pre><a id="youtube-original">YouTube 원본</a></details><details id="youtube-lyrics"><summary>가사 펼치기</summary><pre id="youtube-lyrics-text"></pre></details></div></section><div id="yt-videos" hidden>'+rawRows.map(r=>'<article class="yt-card" data-browse-key="'+esc(r.key)+'"><button class="yt-watch" '+(r.video?'data-video="'+esc(r.video)+'"':'data-coming-key="'+esc(r.key)+'" data-coming-art="'+esc(r.thumb)+'"')+' data-title="'+esc(r.title)+'">재생</button><h2>'+esc(r.title)+'</h2></article>').join('')+'</div></main></body></html>';
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname.endsWith('youtube.com')){requests.push(u.pathname);return route.fulfill({body:'<!doctype html><html style="background:#101114;color:white"><p>YouTube 영상 연결 확인</p></html>',contentType:'text/html'});}
   if(u.origin===base&&u.pathname==='/noa-preview-fixture')return route.fulfill({body:html,contentType:'text/html'});
   if(u.origin===base&&u.pathname==='/noa-category-order.php')return route.fulfill({json:order});
   if(u.origin===base&&u.pathname==='/noa-bridge/membership.php')return route.fulfill({json:account});
   if(u.origin===base&&u.pathname==='/noa-inline-edit.php')return route.fulfill({status:403,json:{ok:false}});
   if(u.origin===base&&u.pathname==='/bbs/logout.php'){assert.equal(u.searchParams.get('url'),'/');account={ok:true,member:false};return route.fulfill({status:302,headers:{Location:'/noa-preview-fixture?genre='+genre},body:''});}
   if(!['GET','HEAD'].includes(route.request().method()))return route.fulfill({status:204,body:''});
   if(phase==='candidate'&&['noa-browse.js','noa-account.js','noa-account.css','noa-youtube.js'].some(n=>u.pathname==='/'+n))return route.fulfill({path:process.cwd()+'/deploy'+u.pathname,contentType:u.pathname.endsWith('.js')?'application/javascript':'text/css'});
   return route.continue();
  });
  await page.goto(base+'/noa-preview-fixture?genre='+genre);
  for(const file of ['noa-browse-edit.js','noa-browse-order.js','noa-browse.js','noa-youtube.js','noa-account.js']){const code=phase==='candidate'?readFileSync('deploy/'+file,'utf8'):await(await context.request.get(base+'/'+file+'?qa='+Date.now())).text();await page.addScriptTag({content:code});}
  await page.evaluate(rows=>{let browse;const cards=[...document.querySelectorAll('[data-browse-key]')],render=()=>{if(!browse)return;const view=browse.apply(rows),keys=new Set(view.visible.map(r=>r.key));for(const c of cards)c.hidden=!keys.has(c.dataset.browseKey);document.getElementById('yt-videos').append(...view.visible.map(r=>cards.find(c=>c.dataset.browseKey===r.key)).filter(Boolean));document.getElementById('yt-videos').hidden=view.stage!=='songs';};browse=window.NoaBrowse.mount({host:document.getElementById('youtube-browse'),rows,onChange:render,search:document.getElementById('youtube-search'),kind:'영상'});render();},sourceRows);
  await page.locator('.noa-edit-edit').first().waitFor();
  const tested=[];
  if(group!=='original'){
   for(const playlist of order.playlists.filter(p=>p.group===group)){
    const record=sourceRows.find(r=>r.customPlaylistId===playlist.id);if(!record)continue;
    const section=page.locator('.noa-user-playlist[data-playlist-id="'+playlist.id+'"]');
    await section.locator(':scope>.noa-browse-card').click();
    assert(await section.locator('.noa-inline-playback #yt-player').isVisible(),'collection opens its own player');
    if(record.video){await page.waitForFunction(id=>document.getElementById('yt-frame').src.includes('/embed/'+id),record.video);assert(await section.locator('#yt-frame').isVisible());}
    else {assert(record.comingSoon);assert(await section.locator('#yt-coming-preview').isVisible());}
    assert(await section.locator('[data-browse-level="4"]').isHidden(),'title playback leaves song list closed');
    const count=requests.length;
    await section.locator('.noa-list-toggle').click();assert(await section.locator('[data-browse-level="4"]').isVisible());
    await section.locator('.noa-list-toggle').click();assert(await section.locator('[data-browse-level="4"]').isHidden());
    assert.equal(requests.length,count,'list expansion cannot reload the playing iframe');
    tested.push({id:playlist.id,title:playlist.title,video:record.video||null,pending:!!record.comingSoon,synthetic:playlist.id===fixtureId});
   }
   assert(tested.some(x=>x.synthetic),'positive story/cover regression executed');
  }
  const row=page.locator('.noa-inline-song[data-inline-key="'+item.key+'"]');
  const selectedRow=await row.count()>1?row.first():row;
  if(!await selectedRow.isVisible())await page.locator('.noa-inline-act').filter({has:selectedRow}).locator('.noa-list-toggle').click();
  await selectedRow.click();await page.waitForFunction(id=>document.getElementById('yt-frame').src.includes('/embed/'+id),item.video);
  const detail=await page.evaluate(()=>{const f=document.getElementById('yt-frame');return{src:f.getAttribute('src'),width:f.getBoundingClientRect().width,visible:!!f.getBoundingClientRect().height&&!f.closest('[hidden]')};});
  assert(detail.visible);assert(detail.width>=width*(width<800?.65:.3));
  const logout=page.locator('#noa-account-bar a[href="/bbs/logout.php?url=%2F"]');await logout.waitFor();
  const boxes=await page.locator('#noa-account-bar a').evaluateAll(ns=>ns.map(n=>{const b=n.getBoundingClientRect();return{x:b.x,y:b.y,right:b.right,bottom:b.bottom,height:b.height};}));
  assert(boxes.every(b=>b.x>=0&&b.right<=width+1&&b.height>=44),'header fit and touch targets');
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert(!(a.x<b.right-1&&a.right>b.x+1&&a.y<b.bottom-1&&a.bottom>b.y+1),'header links overlap');}
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  await page.screenshot({path:out+'/'+phase+'-'+genre+'-'+theme+'-'+width+'.png'});
  // A native logout route is used, and the header removes logout after a guest response.
  await logout.click();await page.waitForURL('**/noa-preview-fixture?genre=*');
  const accountCode=phase==='candidate'?readFileSync('deploy/noa-account.js','utf8'):await(await context.request.get(base+'/noa-account.js?qa='+Date.now())).text();await page.addScriptTag({content:accountCode});
  await page.locator('#noa-account-bar .noa-account-status a[href*="login"]').waitFor();assert.equal(await page.locator('#noa-account-bar a[href*="logout"]').count(),0);
  results.push({phase,width,theme,genre,collections:tested,individualSelection:detail,logoutVisible:true,logoutUsesNativeRoute:true,guestHidesLogout:true,noOverflow:true,errors,providerTransport:'fixture',accountData:'fixture',catalogData:'operating public SQL projection'});
  await context.close();
 }
 assert(results.length===18);
}finally{writeFileSync(out+'/'+phase+'.json',JSON.stringify(results,null,2));await browser.close();}
console.log('PREVIEW_BROWSER_OK',phase,results.length);
