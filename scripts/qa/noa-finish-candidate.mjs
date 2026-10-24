import {createRequire} from 'node:module';
const {chromium}=createRequire(process.env.NOA_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright');
import {readFileSync,writeFileSync,mkdirSync}from'node:fs';
import {resolve}from'node:path';
const origin='https://noastudio.ai.kr',root=process.cwd(),out=resolve('category-proof/candidate/finish.json');mkdirSync(resolve('category-proof/candidate'),{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});const cases=[];
function check(name,ok){cases.push({name,ok:!!ok});if(!ok)throw Error(name);}
try{
 const c=await browser.newContext(),response=await c.request.get(origin+'/noa-music.php'),original=await response.text();
 const start=original.indexOf('const records='),end=original.indexOf('</script>',start);check('public_fixture_present',start>=0&&end>start);
 const arrayEnd=original.indexOf(';\nconst collections=',start),records=JSON.parse(original.slice(start+14,arrayEnd));
 const collectionStart=arrayEnd+2,collectionEnd=original.indexOf(';',collectionStart);const collections=JSON.parse(original.slice(collectionStart+18,collectionEnd));
 const php=readFileSync(resolve(root,'deploy/noa-music.php'),'utf8');let script=php.slice(php.indexOf('const records='),php.indexOf('</script>',php.indexOf('const records=')));
 const slim=records.map(({rawLyrics,lyrics,description,...rest})=>rest);script=script.replace(/^const records=.*;$/m,'const records='+JSON.stringify(slim)+';').replace(/^const collections=.*;$/m,'const collections='+JSON.stringify(collections)+';');check('candidate_inline_php_resolved',!script.includes('<?'));
 let html=original.slice(0,start)+script+original.slice(end);html=html.replace('id="my-save"','id="my-delete" type="button" disabled>목록 삭제</button><button id="my-save"');
 const details=new Map(records.map(r=>[r.key,{key:r.key,rawLyrics:r.rawLyrics||r.lyrics||'',description:r.description||''}]));
 await c.route('**/noa-music.php*',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html}));
 await c.route('**/noa-music-detail.php*',async route=>{const key=new URL(route.request().url()).searchParams.get('key');if(key===records[0].key)await new Promise(r=>setTimeout(r,700));await route.fulfill({status:details.has(key)?200:404,contentType:'application/json',body:JSON.stringify(details.get(key)||{})});});
 for(const [url,file]of[['**/noa-app/p0-player.js*','deploy/noa-app/p0-player.js'],['**/noa-playlists.js*','deploy/noa-playlists.js']])await c.route(url,route=>route.fulfill({status:200,contentType:'text/javascript',body:readFileSync(resolve(root,file),'utf8')}));
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));const playable=records.find(r=>r.audio&&r.kind!=='playlist');check('actual_audio_fixture_available',!!playable);
 await p.goto(origin+'/noa-music.php?track='+encodeURIComponent(playable.key),{waitUntil:'domcontentloaded',timeout:90000});
 await p.waitForFunction(()=>!document.getElementById('song-description').textContent.includes('불러오는 중'),{timeout:15000});
 check('raw_lyrics_rendered',await p.locator('#lyrics').textContent()===(playable.rawLyrics||playable.lyrics||'등록된 가사가 없습니다.'));
 await p.locator('#pause-play').click();await p.waitForFunction(()=>{const a=document.getElementById('sound-player');return !a.paused&&a.currentTime>.3;},{timeout:45000});
 const before=await p.evaluate(()=>({src:document.getElementById('sound-player').currentSrc,time:document.getElementById('sound-player').currentTime}));
 await p.locator('#music-lyrics summary').click();await new Promise(r=>setTimeout(r,1000));const after=await p.evaluate(()=>({src:document.getElementById('sound-player').currentSrc,time:document.getElementById('sound-player').currentTime,paused:document.getElementById('sound-player').paused,title:navigator.mediaSession?.metadata?.title}));
 check('detail_hydration_keeps_original_audio_running',!after.paused&&after.src===before.src&&after.time>before.time+.5);check('native_media_session_reuses_selected_track',after.title===playable.title);check('no_runtime_errors',errors.length===0);
 await p.locator('#pause-play').click();
 const a=records[0],b=records.find(r=>r.key!==a.key&&r.kind!=='playlist');
 await p.evaluate(key=>window.dispatchEvent(new CustomEvent('noa-shell-track',{detail:{key,play:false}})),a.key);
 await p.evaluate(key=>window.dispatchEvent(new CustomEvent('noa-shell-track',{detail:{key,play:false}})),b.key);
 await new Promise(r=>setTimeout(r,1000));check('slow_previous_detail_cannot_overwrite_latest_selection',await p.locator('#lyrics').textContent()===(b.rawLyrics||b.lyrics||'등록된 가사가 없습니다.'));
 await p.screenshot({path:resolve('category-proof/candidate/music-finish.png')});await c.close();
}catch(e){cases.push({name:'candidate_error',ok:false,error:e.message});process.exitCode=1;}finally{await browser.close();writeFileSync(out,JSON.stringify({ok:cases.every(c=>c.ok),cases,scope:'candidate HTML and real existing audio; isolated detail route',productionMutation:false},null,2));console.log(JSON.stringify({cases,report:out}));}
