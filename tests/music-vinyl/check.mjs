import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {createServer} from 'node:http';
const wav=Buffer.alloc(44+16000*5);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
const html='<!doctype html><html lang="ko" data-noa-style="starlight" data-noa-precision="1"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-starlight.css"><link rel="stylesheet" href="/noa-music-vinyl.css"><body class="noa-page"><main><h1>음원</h1><section id="music-browse"></section><audio id="sound-player" src="/tone.wav"></audio><div id="songs"><div class="song selected" data-key="a"><button class="song-select"><span class="cover">♫</span>첫 곡</button></div></div><div class="noa-two-line"><img id="dock-cover" hidden><span id="dock-cover-empty">♫</span></div></main><script src="/noa-browse.js"></script><script src="/noa-music-vinyl.js"></script><script>const tree=NoaBrowse.mount({host:document.querySelector("#music-browse"),rows:[],onChange:()=>tree.apply([])});tree.apply([]);</script></body></html>';
const server=createServer((req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/tone.wav'){res.writeHead(200,{'Content-Type':'audio/wav'});return res.end(wav);}
 if(path==='/'){res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});return res.end(html);}
 const file=path.startsWith('/noa-assets/editorial-')?'deploy/noa-assets/editorial/'+path.split('editorial-')[1]:path.startsWith('/noa-assets/splash/')?'public/splash/'+path.split('/').pop():'deploy'+path;
 try{res.setHeader('Content-Type',path.endsWith('.js')?'application/javascript;charset=utf-8':path.endsWith('.css')?'text/css;charset=utf-8':'image/webp');res.end(readFileSync(file));}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});mkdirSync('music-vinyl-proof',{recursive:true});
try{for(const width of [320,390,1280]){
 const p=await browser.newPage({viewport:{width,height:880}});await p.goto('http://127.0.0.1:'+server.address().port+'/');
 if(width===390){
  const genrePage=await browser.newPage({viewport:{width,height:880}});
  const rows=Array.from({length:41},(_,i)=>({key:'qa-'+i,title:'Track '+i,genre:i<40?'kpop-original':'jpop-original',ep:i%40+1}));
  const songs=rows.slice(0,40).map(r=>'<article class="song" data-key="'+r.key+'" data-audio="master.mp3" data-audio-sha="verified"></article>').join('');
  const fixture=html.replace('<div id="songs" hidden>', '<div id="songs" hidden>'+songs)
   .replace('<div id="songs">','<div id="songs">'+songs)
   .replace('const tree=','const records='+JSON.stringify(rows)+',collections=[];const tree=').replace('rows:[]','rows:records');
  await genrePage.route('**/genre-fixture?*',route=>route.fulfill({contentType:'text/html',body:route.request().url().includes('qaAdmin')?fixture.replace('<meta charset', '<meta name="noa-jukebox-csrf"><meta charset'):fixture}));
  try{
   await genrePage.goto('http://127.0.0.1:'+server.address().port+'/genre-fixture?group=original&genre=kpop-original&qaAdmin=1');
   const cards=genrePage.locator('[data-browse-level="2"] .noa-browse-card');
   await cards.first().getByText('40/40곡 완료').waitFor();
   assert.equal(await cards.first().getAttribute('data-lp-complete'),'true');
   assert.equal(await cards.nth(1).getAttribute('data-lp-complete'),'false');
   assert.notEqual(await cards.first().evaluate(n=>getComputedStyle(n,'::after').clipPath),'none');
   await genrePage.locator('#songs [data-key="qa-0"]').evaluate(n=>n.removeAttribute('data-audio-sha'));
   await cards.first().getByText('39/40곡 완료').waitFor();
   assert.equal(await cards.first().getAttribute('data-lp-complete'),'false');
   await genrePage.locator('.noa-inline-song-row[data-inline-key="qa-0"] .noa-inline-title').first().evaluate(el=>{
    const badge=document.createElement('span');badge.className='noa-premium-badge';el.append(badge);
   });
   await cards.first().getByText('40/40곡 완료').waitFor();
   await genrePage.goto('http://127.0.0.1:'+server.address().port+'/genre-fixture?group=original&genre=kpop-original');
   await genrePage.locator('[data-browse-level="2"] [data-lp-complete="true"]').waitFor();
   assert.equal(await genrePage.locator('.lp-tally').count(),0);
   assert.equal(await cards.first().locator('img').evaluate(n=>getComputedStyle(n).borderTopWidth),'3px');
   for(const card of await cards.all()){
    const photo=card.locator('img');
    await photo.evaluate(n=>n.decode());
    assert.equal(await photo.evaluate(n=>n.naturalWidth),720);
    assert(await card.evaluate(n=>{
     const caption=n.querySelector(':scope>span'),photo=n.querySelector('img').getBoundingClientRect(),title=caption.querySelector('strong').getBoundingClientRect();
     return title.top>=photo.top && title.bottom<=photo.bottom && getComputedStyle(caption).backgroundColor==='rgba(0, 0, 0, 0)';
    }));
    assert.equal(await photo.evaluate(n=>getComputedStyle(n).objectPosition),'50% 16%');
   }
  }finally{await genrePage.close();}
 }
 const mismatchPage=await browser.newPage({viewport:{width,height:880}});
 const mismatchRows=[
  {key:'translated',title:'At the end of the day',genre:'pop-original',ep:'01'},
  {key:'same',title:'  작은   떨림 ',genre:'pop-original',ep:'02'},
  {key:'unknown',title:'Unknown',genre:'pop-original',ep:'99'},
  {key:'kpop',title:'다른 이름',genre:'kpop-original',ep:'01'},
  {key:'ep',title:'긴 밤의 이야기',genre:'joseon-ballad',ep:'01'},
  {key:'cover',title:'커버',originalArtist:'원곡 가수',genre:'cover-reborn',ep:'01'}
 ];
 const mismatchFixture=html.replace('<body ', '<link rel="stylesheet" href="/noa-engagement.css"><body ')
  .replace('<script src="/noa-browse.js">','<script type="application/json" id="noa-original-titles">'+JSON.stringify({1:'하루의 끝에',2:'작은 떨림'})+'</script><script src="/noa-browse.js">')
  .replace('const tree=','const records='+JSON.stringify(mismatchRows)+',collections=[];const tree=').replace('rows:[]','rows:records');
 await mismatchPage.route('**/mismatch?*',route=>route.fulfill({contentType:'text/html',body:mismatchFixture}));
 try{
  await mismatchPage.goto('http://127.0.0.1:'+server.address().port+'/mismatch?group=original&genre=pop-original&act=1');
  const credit=mismatchPage.locator('.noa-original-title');
  await credit.waitFor();assert.equal(await credit.count(),1);assert.equal(await credit.textContent(),'≠원곡: 하루의 끝에');
  const title=mismatchPage.locator('[data-inline-key="translated"] .noa-inline-title');
  await title.evaluate(n=>{const b=document.createElement('span');b.className='noa-premium-badge';b.textContent='PREMIUM';n.append(b);});
  assert(await title.evaluate(n=>{const box=x=>n.querySelector(x).getBoundingClientRect();return box('.noa-original-title').top>=box('.noa-track-name').bottom&&box('.noa-premium-badge').bottom<=box('.noa-track-name').top&&Math.abs(box('.noa-premium-badge').right-n.closest('.noa-inline-song-row').getBoundingClientRect().right)<=3;}));
  assert(await mismatchPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await mismatchPage.screenshot({path:'music-vinyl-proof/original-title-'+width+'.png'});
  const trackName=title.locator('.noa-track-name');
  await trackName.evaluate(n=>n.textContent='줄바꿈 없이 지나가는 긴 제목 '.repeat(12));
  await title.locator('.lp-title-overflow>.lp-title-text').waitFor();
  assert(await trackName.evaluate(n=>{
   const box=n.getBoundingClientRect(),credit=n.parentElement.querySelector('.noa-original-title').getBoundingClientRect();
   return box.height===24 && Math.abs(box.left-credit.left)<1 && credit.top>=box.bottom && credit.top-box.bottom<=6
    && getComputedStyle(n.firstElementChild).animationName==='noa-title-pan';
  }),'Long title pans on one line above its aligned credit');
  const movingTitle=trackName.locator('.lp-title-text');
  const viewSwitch=trackName.locator('xpath=ancestor::*[contains(@class,"noa-inline-songs")][1]/preceding-sibling::*[1]');
  await viewSwitch.locator('[data-mode=album]').click();
  await mismatchPage.waitForFunction(()=>document.querySelector('[data-inline-key="translated"]')?.closest('.noa-inline-songs')?.dataset.trackView==='album');
  assert(await movingTitle.evaluate(n=>!n.closest('.noa-inline-song-row').matches(':focus-within,:has(.lp-running)') && getComputedStyle(n).animationName==='noa-title-pan'));
  const startX=await movingTitle.evaluate(n=>n.getBoundingClientRect().left);
  await mismatchPage.waitForFunction(x=>{
   const n=document.querySelector('[data-inline-key="translated"] .lp-title-text');
   return n&&n.getBoundingClientRect().left<x-8;
  },startX,{timeout:1800});
  await viewSwitch.locator("[data-mode=list]").click();
  await mismatchPage.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await trackName.locator('.lp-title-text').evaluate(n=>getComputedStyle(n).animationName),'none');
  await trackName.evaluate(n=>n.textContent='봄');
  await mismatchPage.waitForFunction(()=>!document.querySelector('[data-inline-key="translated"] .noa-track-name').classList.contains('lp-title-overflow'));
  const badgeRight=await title.locator('.noa-premium-badge').evaluate(n=>n.getBoundingClientRect().right);
  await mismatchPage.evaluate(()=>{records[0].title='하루의 끝에';document.querySelector('.noa-track-name').textContent='하루의 끝에';});
  await mismatchPage.waitForFunction(()=>!document.querySelector('.noa-original-title'));
  assert.equal(await title.locator('.noa-premium-badge').evaluate(n=>n.getBoundingClientRect().right),badgeRight,'Premium position must not depend on original-title credit');
  for(const [group,genre,count] of [['original','kpop-original',0],['ep','joseon-ballad',1],['cover','cover-reborn',0]]){
   await mismatchPage.goto('http://127.0.0.1:'+server.address().port+'/mismatch?group='+group+'&genre='+genre+'&act=1');
   await mismatchPage.locator('.noa-inline-song').first().waitFor({state:'attached'});
   await mismatchPage.waitForFunction(()=>document.querySelector('.lp-edition'));
   assert.equal(await mismatchPage.locator('.noa-original-title').count(),count);
   const list=mismatchPage.locator('.noa-inline-songs').first();
   assert.equal(await list.getAttribute('data-track-view'),group==='cover'?'album':'list');
   if(group==='cover'){
    await mismatchPage.evaluate(()=>{
     const track=document.createElement('div');track.className='song';track.dataset.key='cover';track.dataset.originalArtist='원곡 가수';document.querySelector('#songs').append(track);
    });
    await mismatchPage.waitForFunction(()=>document.querySelector('.lp-cover-credit')?.textContent==='원곡 가수');
    assert(!(await list.locator('.lp-title-text').first().textContent()).includes('원곡 가수'));
    await mismatchPage.locator('.lp-view-switch [data-mode=list]').first().evaluate(b=>b.click());
    await mismatchPage.waitForFunction(()=>document.querySelector('.noa-inline-songs').dataset.trackView==='list');
    await mismatchPage.reload();
    await mismatchPage.waitForSelector('.noa-inline-songs[data-track-view=list]',{state:'attached'});
    await mismatchPage.locator('.lp-view-switch [data-mode=album]').first().evaluate(b=>b.click());
    await mismatchPage.waitForSelector('.noa-inline-songs[data-track-view=album]',{state:'attached'});
    const geometry=await list.evaluate(list=>{
     const row=list.querySelector('.noa-inline-song-row');
     for(let parent=row;parent;parent=parent.parentElement)parent.hidden=false;
     row.style.setProperty('--tool-count','4');
     const actions=row.querySelector('.noa-song-actions');
     actions.replaceChildren();
     const tools=['수정','담기','다운로드','교체'].map((label,index)=>{
      const button=document.createElement('button');
      button.className='noa-direct-action'+(index?' noa-song-action':' noa-edit-edit');
      button.textContent=label;
      (index?actions:row).append(button);
      return button;
     });
     const title=row.querySelector('.noa-inline-title');
     if(!title.querySelector('.noa-premium-badge')){
      const badge=document.createElement('span');badge.className='noa-premium-badge';title.append(badge);
     }
     return {rects:tools.map(b=>b.getBoundingClientRect().toJSON()),frame:getComputedStyle(row).boxShadow,corner:getComputedStyle(row,'::after').content};
    });
    const playing=await list.evaluate(list=>{
     const art=list.querySelector('.lp-track-art'), badge=list.querySelector('.noa-premium-badge');
     art.classList.add('lp-running','lp-on-record');
     const rect=art.getBoundingClientRect(), jacket=art.querySelector('.lp-track-jacket').getBoundingClientRect();
     return {credit:getComputedStyle(art,'::before').content,disc:getComputedStyle(art.querySelector('.lp-spindle')).display,
      widthDifference:Math.abs(rect.width-jacket.width),ribbonOffset:Math.abs(rect.top-badge.getBoundingClientRect().top)};
    });
    assert(playing.credit.includes('재생 중') && playing.disc==='none' && playing.widthDifference<=1 && playing.ribbonOffset<=1,JSON.stringify(playing));
    assert.equal(geometry.frame,'none');
    assert.equal(geometry.corner,'none');
    const sorted=geometry.rects.sort((a,b)=>a.x-b.x);
    assert(sorted.every((r,i)=>r.width>0 && r.height>=44 && Math.abs(r.y-sorted[0].y)<1 && (!i || r.x>=sorted[i-1].right-1)),JSON.stringify(geometry));
    await mismatchPage.addScriptTag({url:'/noa-browse-edit.js'});
    await list.evaluate(list=>{
     const card=list.querySelector('.noa-inline-song-row');
     const other=card.cloneNode(true);card.after(other);
     card.querySelector('.noa-edit-edit')?.remove();
     window.NoaBrowseEdit.mount({host:list,rows:[{key:card.dataset.inlineKey,title:'곡 정보 검수'}]});
    });
    let metadata={ok:true,writeKey:'cover',kind:'single',packageType:'cover',revision:1,context:{genre:'cover-reborn'},fields:{title:'편집 전',lyrics:'가사'}};
    let savedPatch=null, failSave=true;
    await mismatchPage.route('**/noa-inline-edit.php*',async route=>{
     if(route.request().method()==='POST'){
      savedPatch=route.request().postDataJSON().patch;
      if(failSave){failSave=false;return route.fulfill({status:503,json:{ok:false}});}
      metadata={...metadata,revision:metadata.revision+1,fields:{...metadata.fields,...savedPatch}};
     }
     await route.fulfill({json:metadata});
    });
    for(const mode of ['album','list']){
     await mismatchPage.locator('.lp-view-switch [data-mode='+mode+']').first().evaluate(b=>b.click());
     await mismatchPage.waitForFunction(mode=>document.querySelector('.noa-inline-songs').dataset.trackView===mode,mode);
     const card=list.locator(':scope>.noa-inline-song-row').first();
     const documentBox=el=>el.evaluate(n=>{const r=n.getBoundingClientRect();return {width:r.width,height:r.height,y:r.y+scrollY};});
     const before=await documentBox(card);
     await card.locator(':scope>.noa-edit-edit').evaluate(b=>b.click());
     const panel=list.locator(':scope>form.noa-edit-form');await panel.waitFor();
     const after=await documentBox(card), box=await documentBox(panel);
     assert(Math.abs(before.width-after.width)<1 && Math.abs(before.height-after.height)<1 && Math.abs(before.y-after.y)<1,JSON.stringify({width,mode,before,after,box}));
     assert(box.width>=(await list.boundingBox()).width*.8 && box.y>=after.y+after.height-1);
     if(mode==='album')assert(Math.abs((await documentBox(list.locator(':scope>.noa-inline-song-row').nth(1))).y-after.y)<1);
     const field=panel.locator('[data-record-field=title]'),input=field.locator('input');
     await field.getByRole('button',{name:'곡 제목 수정',exact:true}).waitFor();
     assert(await input.evaluate(e=>e.readOnly));
     if(mode==='album'){
      await field.getByRole('button',{name:'곡 제목 수정',exact:true}).click();
      await input.fill('개별 저장 확인');
      const commit=field.getByRole('button',{name:'곡 제목 저장',exact:true});
      await commit.click();await panel.getByText(/저장하지 못했습니다/).first().waitFor();
      assert.equal(await input.inputValue(),'개별 저장 확인');
      await commit.click();await field.getByRole('button',{name:'곡 제목 수정',exact:true}).waitFor();
      assert.deepEqual(savedPatch,{title:'개별 저장 확인'});assert(await input.evaluate(e=>e.readOnly));
      const controls=panel.locator('.noa-publish-panel');
      const options=await controls.locator('summary').boundingBox(),generate=await controls.locator(':scope>button').boundingBox();
      assert(Math.abs(options.y-generate.y)<2 && options.x+options.width<=generate.x);
      assert.equal(await panel.locator('[data-record-field]:not(:has(.noa-edit-copy))').count(),0);
      await panel.getByRole('button',{name:'곡정보창 접기'}).click();
      assert(!await field.isVisible());await panel.getByRole('button',{name:'곡정보창 펼치기'}).click();
     }
     await card.locator(':scope>.noa-edit-edit').evaluate(b=>b.click());await panel.waitFor({state:'detached'});
    }

   }
  }
 }finally{await mismatchPage.close();}
 const editions=p.locator('.lp-edition');await editions.first().waitFor();assert.equal(await editions.count(),4);
 await editions.locator('img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));
 for(const card of await editions.all()){
  const within=await card.evaluate(el=>{
   const box=node=>node.getBoundingClientRect();
   const art=box(el.querySelector('.lp-edition-art'));
   const disc=box(el.querySelector('.lp-spindle'));
   const label=box(el.querySelector('strong'));
   return disc.left>=art.left-1 && disc.right<=art.right+1 && label.top>=art.bottom-1 && label.bottom<=box(el).bottom+1;
  });
  assert(within,'Disc and category caption must fit their own sleeve');
 }
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 const awards=[
  ['story:your-story:4e75f1a6f5919a67c7b9cbb7','예선 1위'],
  ['story:your-story:ee00443af14f2754a18a6b1c','본선 1위'],
  ['story:your-story:86c38c573de24a6ac5b793a5','결선 1위'],
  ['story:your-story:35fa27149612463491996053','예선 참가곡'],
  ['catalog:a785dbc3e646c64b54cd1536048100e5ee66f55ec9be69d39e6b5251c91f4bba','본선 참가곡'],
  ['story:your-story:6d2ff36af19c40d596c51002','결선 참가곡']
 ];
 await p.evaluate(keys=>{
  const box=document.createElement('div');
  for(const key of [...keys,'different-song']){
   const row=document.createElement('button');row.className='noa-inline-song';row.dataset.inlineKey=key;
   row.innerHTML='<span class="noa-inline-title"><span class="noa-track-name">곡 제목</span></span>';box.append(row);
  }
  document.querySelector('#music-browse').append(box);
 },awards.map(([key])=>key));
 await p.locator('.noa-amt-award').first().waitFor();
 assert.deepEqual(await p.locator('.noa-amt-award').allTextContents(),awards.map(([,award])=>award));
 await p.evaluate(()=>{
  const title=document.querySelector('.noa-inline-song .noa-inline-title');
  title.style.width='145px';
  const premium=document.createElement('span');premium.className='noa-premium-badge';premium.textContent='PREMIUM';title.append(premium);
 });
 const heading=p.locator('.noa-inline-song .noa-inline-title').first();
 for(const name of ['가을빛','제목이 긴 음악에서도 프리미엄 표시는 곡 이름 바로 옆에 보입니다']){
  await heading.locator('.noa-track-name').evaluate((el,value)=>el.textContent=value,name);
  const geometry=await heading.evaluate(title=>{
   const box=sel=>title.querySelector(sel).getBoundingClientRect();
   const n=box('.noa-track-name'),p=box('.noa-premium-badge'),a=box('.noa-amt-award');
   return [p.left-n.right,p.right<=title.getBoundingClientRect().right+1,a.top>=n.bottom-1];
  });
  assert(geometry[0]>=0&&geometry[0]<=8&&geometry[1]&&geometry[2],'Premium stays beside the title; award stays below');
 }
 await p.evaluate(()=>document.querySelector('audio').play());
 await p.locator('.lp-dock-art.lp-running').waitFor();
 const disc=p.locator('.lp-dock-art>.lp-spindle');assert.equal(await disc.evaluate(n=>getComputedStyle(n).animationPlayState),'running');
 assert.equal(await p.locator('.song .lp-running').count(),1);
 // The cover transport must control the current audio without restarting it.
 await p.evaluate(()=>{
  const row=document.createElement('div');row.id='sleeve-transport-test';row.className='noa-inline-song-row noa-has-support';row.dataset.inlineKey='a';
  row.innerHTML='<button class="noa-inline-song" data-inline-key="a"><span class="cover">♫</span><span class="noa-inline-title"><span class="noa-track-name">긴 제목의 커버 재생 버튼 확인</span><span class="noa-premium-badge">PREMIUM</span></span></button><div class="noa-song-actions"><button class="noa-song-action" aria-label="테스트 재생"><svg viewBox="0 0 24 24"></svg><span>0</span></button></div>';
  document.querySelector('#music-browse').append(row);
 });
 const transport=p.locator('#sleeve-transport-test .lp-cover-toggle');await transport.waitFor();
 assert.equal(await p.locator('#sleeve-transport-test .lp-play-count').count(),0);
 assert.equal(await transport.locator('span').evaluate(n=>getComputedStyle(n).display),'none');
 assert(await transport.evaluate(n=>{const row=n.closest('.noa-inline-song-row'),a=row.querySelector('.lp-track-jacket').getBoundingClientRect(),b=n.getBoundingClientRect(),disc=row.querySelector('.lp-spindle').getBoundingClientRect();return Math.abs((a.left+a.right-b.left-b.right)/2)<2&&Math.abs((a.top+a.bottom-b.top-b.bottom)/2)<2&&Math.abs(disc.left+disc.width/2-a.left)<1;}),'Transport centered on cover; exactly half the record is exposed');
 await transport.click();await p.waitForFunction(()=>document.querySelector('audio').paused);
 await p.waitForFunction(()=>getComputedStyle(document.querySelector('#sleeve-transport-test .lp-spindle')).visibility==='hidden');
 assert(await transport.evaluate(n=>{const s=getComputedStyle(n);return s.backgroundColor==='rgba(0, 0, 0, 0)'&&s.borderTopWidth==='0px';}),'Cover play icon has no circular background or border');
 const pausedAt=await p.locator('audio').evaluate(n=>n.currentTime);
 await transport.click();await p.waitForFunction(()=>!document.querySelector('audio').paused);
 assert(await p.locator('audio').evaluate(n=>n.currentTime)>=pausedAt,'Resume preserves playback position');
 await p.locator('#sleeve-transport-test').evaluate(row=>{
  const album=document.createElement('div');album.dataset.trackView='album';row.before(album);album.append(row);
 });
 const meter=p.locator('#sleeve-transport-test .lp-album-meter');
 await meter.waitFor();
 const firstFrame=await meter.screenshot();
 await p.waitForTimeout(180);
 assert(!firstFrame.equals(await meter.screenshot()),'Playing album meter must paint different frames in real time');
 await p.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await meter.locator('span').first().evaluate(n=>getComputedStyle(n).animationName),'none');
 await p.emulateMedia({reducedMotion:'no-preference'});
 await transport.click();await meter.waitFor({state:'hidden'});
 await transport.click();await meter.waitFor();
 await p.locator('#sleeve-transport-test').evaluate(n=>n.remove());
 if(width===390){
  await p.evaluate(()=>{
   document.querySelector('audio').loop=true;
   document.body.style.paddingBottom='220vh';
   window.scrollTo(0,document.body.scrollHeight);
  });
  await p.waitForTimeout(5500);
  await p.mouse.wheel(0,-60);
  await p.waitForTimeout(5500);
  assert(await p.locator('.song .lp-running').evaluate(el=>el.getBoundingClientRect().bottom<0),'Browsing restarts the idle countdown');
  await p.waitForFunction(()=>document.querySelector('.song .lp-running')?.getBoundingClientRect().top>=0,{},{timeout:8000});
 }
 await p.evaluate(()=>document.querySelector('audio').pause());
 await p.waitForFunction(()=>!document.querySelector('.lp-dock-art').classList.contains('lp-running'));
 assert.equal(await disc.evaluate(n=>getComputedStyle(n).animationPlayState),'paused');
 await p.evaluate(()=>document.querySelector('audio').play());await p.locator('.lp-dock-art.lp-running').waitFor();
 await p.evaluate(()=>document.querySelector('audio').dispatchEvent(new Event('waiting')));await p.waitForFunction(()=>!document.querySelector('.lp-dock-art.lp-running'));
 await p.evaluate(()=>window.dispatchEvent(new CustomEvent('noa-track-selected',{detail:{record:{key:'b'}}})));await p.waitForFunction(()=>!document.querySelector('.lp-dock-art.lp-on-record'));assert.equal(await p.locator('.song .lp-on-record').count(),0);
 await p.emulateMedia({reducedMotion:'reduce'});assert.equal(await disc.evaluate(n=>getComputedStyle(n).animationName),'none');
 await p.screenshot({path:'music-vinyl-proof/view-'+width+'.png'});await p.close();
}console.log('REAL_AUDIO_PLAY_PAUSE_RESUME_WAIT_TRACK_CHANGE_REDUCED_MOTION_OK');}finally{await browser.close();server.close();}
