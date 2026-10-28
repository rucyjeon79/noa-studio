import {createRequire} from 'node:module';
const {chromium}=createRequire(process.env.NOA_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright');
import {readFileSync,writeFileSync,mkdirSync}from'node:fs';
import {resolve}from'node:path';
import {spawn}from'node:child_process';
const origin='http://127.0.0.1:8095',root=process.cwd(),out=resolve('category-proof/candidate/finish.json');mkdirSync(resolve('category-proof/candidate'),{recursive:true});
const server=spawn('php',['-S','127.0.0.1:8095','tests/p0/router.php'],{stdio:'ignore'});
for(let n=0;n<50;n++){try{if((await fetch(origin+'/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});const cases=[];
function check(name,ok){cases.push({name,ok:!!ok});if(!ok)throw Error(name);}
try{
 const c=await browser.newContext(),response=await c.request.get(origin+'/noa-music.php'),original=await response.text();
 const start=original.indexOf('const records='),end=original.indexOf('</script>',start);check('isolated_php_fixture_present',start>=0&&end>start);
 const arrayEnd=original.indexOf(';\nconst collections=',start),records=JSON.parse(original.slice(start+14,arrayEnd));
 const collectionStart=arrayEnd+2,collectionEnd=original.indexOf(';\nconst buttons=',collectionStart);const collections=JSON.parse(original.slice(collectionStart+18,collectionEnd));
 const php=readFileSync(resolve(root,'deploy/noa-music.php'),'utf8');let script=php.slice(php.indexOf('const records='),php.indexOf('</script>',php.indexOf('const records=')));
 const slim=records.map(({rawLyrics,lyrics,description,...rest})=>rest);script=script.replace(/^const records=.*;$/m,'const records='+JSON.stringify(slim)+';').replace(/^const collections=.*;$/m,'const collections='+JSON.stringify(collections)+';');check('candidate_inline_php_resolved',!script.includes('<?'));
 let html=original.slice(0,start)+script+original.slice(end);if(!html.includes('id="my-delete"'))html=html.replace('id="my-save"','id="my-delete" type="button" disabled>목록 삭제</button><button id="my-save"');
 const playable=records.find(r=>r.audio&&r.kind!=='playlist'),a=records.find(r=>r.key!==playable?.key&&r.kind!=='playlist'),b=records.find(r=>r.key!==a?.key&&r.kind!=='playlist');check('isolated_decodable_audio_fixture_available',!!playable&&!!a&&!!b);
 for(const r of [playable,a,b])if(!('rawLyrics'in r)){const response=await c.request.get(origin+'/noa-music-detail.php?key='+encodeURIComponent(r.key));check('existing_detail_endpoint_for_reentrant_fixture',response.ok());Object.assign(r,await response.json());}
 let releaseDetail;const detailGate=new Promise(resolve=>releaseDetail=resolve);
 const details=new Map(records.map(r=>[r.key,{key:r.key,rawLyrics:r.rawLyrics||r.lyrics||'',description:r.description||''}]));
 await c.route('**/noa-music.php*',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html}));
 await c.route('**/noa-music-detail.php*',async route=>{const key=new URL(route.request().url()).searchParams.get('key');if(key===playable.key)await detailGate;if(key===a.key)await new Promise(r=>setTimeout(r,700));await route.fulfill({status:details.has(key)?200:404,contentType:'application/json',body:JSON.stringify(details.get(key)||{})});});
 for(const [url,file]of[['**/noa-app/p0-player.js*','deploy/noa-app/p0-player.js'],['**/noa-playlists.js*','deploy/noa-playlists.js']])await c.route(url,route=>route.fulfill({status:200,contentType:'text/javascript',body:readFileSync(resolve(root,file),'utf8')}));
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(origin+'/noa-music.php?track='+encodeURIComponent(playable.key),{waitUntil:'domcontentloaded',timeout:90000});
 await p.locator('#pause-play').click();await p.waitForFunction(()=>{const a=document.getElementById('sound-player');return !a.paused&&a.currentTime>.3;},{timeout:45000});
 const before=await p.evaluate(()=>({src:document.getElementById('sound-player').currentSrc,time:document.getElementById('sound-player').currentTime}));
 releaseDetail();await p.waitForFunction(expected=>document.getElementById('lyrics').textContent===expected,playable.rawLyrics||playable.lyrics||'등록된 가사가 없습니다.',{timeout:15000});check('raw_lyrics_preserved_in_model',await p.locator('#lyrics').textContent()===(playable.rawLyrics||playable.lyrics||'등록된 가사가 없습니다.'));
 check('audio_only_selection_hides_details',await p.locator('[aria-label="곡 상세"]').isHidden());await p.waitForFunction(t=>document.getElementById('sound-player').currentTime>t+.5,before.time,{timeout:30000});const after=await p.evaluate(()=>({src:document.getElementById('sound-player').currentSrc,time:document.getElementById('sound-player').currentTime,paused:document.getElementById('sound-player').paused,title:navigator.mediaSession?.metadata?.title}));
 check('detail_hydration_keeps_original_audio_running',!after.paused&&after.src===before.src&&after.time>before.time+.5);check('native_media_session_reuses_selected_track',after.title===playable.title);check('no_runtime_errors',errors.length===0);
 for(const width of [360,1280]){await p.setViewportSize({width,height:844});await p.locator('#dock-more').click();await p.locator('#dock-list').click();check('queue_cover_title_rows_'+width,await p.locator('#dock-queue-items .noa-queue-cover').count()===2&&await p.locator('#dock-queue-items .noa-queue-title').count()===2);check('queue_current_track_'+width,await p.locator('#dock-queue-items [aria-current="true"]').count()===1);check('queue_mobile_fit_'+width,await p.locator('#dock-queue').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}));await p.screenshot({path:resolve('category-proof/candidate/queue-'+width+'.png')});await p.getByRole('button',{name:'재생목록 닫기',exact:true}).click();}
 await p.locator('#pause-play').click();
 await p.evaluate(key=>window.dispatchEvent(new CustomEvent('noa-shell-track',{detail:{key,play:false}})),a.key);
 await p.evaluate(key=>window.dispatchEvent(new CustomEvent('noa-shell-track',{detail:{key,play:false}})),b.key);
 await new Promise(r=>setTimeout(r,1000));check('slow_previous_detail_cannot_overwrite_latest_selection',await p.locator('#lyrics').textContent()===(b.rawLyrics||b.lyrics||'등록된 가사가 없습니다.'));
 await p.screenshot({path:resolve('category-proof/candidate/music-finish.png')});await c.close();
}catch(e){cases.push({name:'candidate_error',ok:false,error:e.message.split('\n')[0]});process.exitCode=1;}finally{await browser.close();server.kill();writeFileSync(out,JSON.stringify({ok:cases.every(c=>c.ok),cases,scope:'actual candidate PHP/JS with isolated synthetic catalogue and decodable WAV; operating member verification is separate',productionMutation:false},null,2));console.log(JSON.stringify({cases,report:out}));}
