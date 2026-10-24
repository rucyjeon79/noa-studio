import {createRequire} from 'node:module';
const {chromium}=createRequire(process.env.NOA_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright');
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const origin='https://noastudio.ai.kr',output=resolve(process.env.NOA_FINISH_QA_OUTPUT||'qa/finish/verified.json');
mkdirSync(dirname(output),{recursive:true});
const baseline=JSON.parse(readFileSync(new URL('../../tests/catalog/public-detail-baseline.json',import.meta.url)));
const cases=[],performanceRows=[];let browser;
const sha=s=>createHash('sha256').update(s).digest('hex');
function check(name,ok,evidence={}){cases.push({name,ok:!!ok,...evidence});if(!ok)throw Error(name);}
function recordsFrom(html){const a=html.indexOf('const records=')+14,b=html.indexOf(';\nconst collections=',a);if(a<14||b<0)throw Error('records absent');return JSON.parse(html.slice(a,b));}
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 const ctx=await browser.newContext(),api=ctx.request;
 const res=await api.get(origin+'/noa-music.php');const html=await res.text(),rows=recordsFrom(html),byKey=new Map(rows.map(r=>[r.key,r]));
 check('public_catalog_identity_preserved',res.ok()&&rows.length===baseline.length&&baseline.every(r=>{const n=byKey.get(r.key);return n&&n.title===r.title&&n.kind===r.kind&&n.audio===r.audio&&n.thumb===r.thumb;}),{count:rows.length});
 check('initial_payload_omits_detail_fields',rows.every(r=>!('rawLyrics'in r)&&!('lyrics'in r)&&!('description'in r)),{decodedBytes:Buffer.byteLength(html),beforeDecodedBytes:3372824});
 check('initial_payload_reduced',Buffer.byteLength(html)<3372824*.8);
 let next=0,verified=0;const mismatch=[];
 await Promise.all(Array.from({length:4},async()=>{while(next<baseline.length){const old=baseline[next++];const response=await api.get(origin+'/noa-music-detail.php?key='+encodeURIComponent(old.key));if(!response.ok()){mismatch.push({key:old.key,status:response.status()});continue;}const data=await response.json();if(data.key!==old.key||sha(data.rawLyrics)!==old.rawLyricsSha256||sha(data.description)!==old.descriptionSha256)mismatch.push({key:old.key,reason:'hash_mismatch'});else verified++;}}));
 check('all_original_public_details_match_sha256',!mismatch.length,{verified,mismatch});
 const invalid=await api.get(origin+'/noa-music-detail.php?key=../config.php');check('detail_key_traversal_rejected',invalid.status()===400,{status:invalid.status()});
 const missing=await api.get(origin+'/noa-music-detail.php?key=single:missing:999');check('detail_missing_key_hidden',missing.status()===404,{status:missing.status()});
 const denial=await api.delete(origin+'/noa-bridge/user-playlists.php',{data:{id:'nonexistent'}});check('anonymous_playlist_delete_denied',[401,403,405,501].includes(denial.status()),{status:denial.status(),mutation:false});
 const protectedReport=await api.get(origin+'/noa-app/engine/completion-report.php');check('unsigned_completion_evidence_rejected',[401,403,405].includes(protectedReport.status()),{status:protectedReport.status()});
 await ctx.close();
 const song=baseline.find(r=>r.audio&&r.kind!=='playlist');check('real_playable_record_present',!!song);
 for(const mobile of[false,true]){
  for(let i=0;i<3;i++){
   const c=await browser.newContext({viewport:{width:mobile?390:1440,height:900}}),p=await c.newPage();
   if(mobile){const d=await c.newCDPSession(p);await d.send('Network.enable');await d.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:200000,uploadThroughput:90000});await d.send('Emulation.setCPUThrottlingRate',{rate:4});}
   const r=await p.goto(origin+'/noa-music.php',{waitUntil:'domcontentloaded',timeout:120000});
   const body=await r.body();const navigation=await p.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];return{ttfb:n.responseStart-n.requestStart,dcl:n.domContentLoadedEventEnd-n.startTime,dom:document.querySelectorAll('*').length,encodedBodySize:n.encodedBodySize,decodedBodySize:n.decodedBodySize};});
   performanceRows.push({mobile,sample:i,bytes:body.length,contentEncoding:r.headers()['content-encoding']||null,...navigation});await c.close();
  }
  const c=await browser.newContext({viewport:{width:mobile?390:1440,height:900}}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(origin+'/noa-music.php?track='+encodeURIComponent(song.key),{waitUntil:'domcontentloaded',timeout:90000});
  await p.waitForFunction(()=>!document.getElementById('song-description').textContent.includes('불러오는 중'),{timeout:15000});
  const actual=await p.locator('#lyrics').textContent();check('selected_detail_display_'+mobile,sha(actual)===song.rawLyricsSha256);
  await p.locator('#pause-play').click();await p.waitForFunction(()=>{const a=document.getElementById('sound-player');return !a.paused&&a.currentTime>.3;},{timeout:45000});
  const initial=await p.evaluate(()=>({src:document.getElementById('sound-player').currentSrc,time:document.getElementById('sound-player').currentTime,title:navigator.mediaSession?.metadata?.title,state:navigator.mediaSession?.playbackState}));
  await p.locator('#music-lyrics summary').click();await p.locator('#music-description summary').click();
  await p.waitForFunction(()=>{const a=document.getElementById('sound-player');for(let i=0;i<a.buffered.length;i++)if(a.buffered.start(i)<=a.currentTime&&a.buffered.end(i)>a.currentTime+4)return true;return false;},null,{timeout:45000});
  const other=await c.newPage();await other.goto('about:blank');await other.bringToFront();await new Promise(r=>setTimeout(r,2000));await p.bringToFront();
  const final=await p.evaluate(()=>({src:document.getElementById('sound-player').currentSrc,time:document.getElementById('sound-player').currentTime,paused:document.getElementById('sound-player').paused,state:navigator.mediaSession?.playbackState}));
  check('browser_background_audio_continues_'+mobile,!final.paused&&final.src===initial.src&&final.time>initial.time+1,{elapsed:final.time-initial.time,physicalScreenOffTested:false});
  check('media_session_metadata_'+mobile,initial.title===song.title&&final.state==='playing');
  check('clean_runtime_'+mobile,errors.length===0,{errors});
  check('mobile_horizontal_bounds_'+mobile,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  await p.screenshot({path:resolve(dirname(output),'music-'+(mobile?'mobile':'desktop')+'.png'),fullPage:false});await p.locator('#pause-play').click();await c.close();
 }
 const sitemapOutput=resolve(dirname(output),'sitemap.json');const sitemap=spawnSync(process.execPath,['scripts/qa/noa-sitemap-live.mjs'],{env:{...process.env,NOA_SITEMAP_QA_OUTPUT:sitemapOutput},encoding:'utf8'});check('sitemap_live_suite',sitemap.status===0,{report:'sitemap.json',output:sitemap.stdout.slice(-1200),error:sitemap.stderr.slice(-1000)});
}catch(e){cases.push({name:'unhandled_failure',ok:false,error:e.message});process.exitCode=1;}
finally{if(browser)await browser.close();const report={ok:cases.length>0&&cases.every(c=>c.ok),origin,createdAt:new Date().toISOString(),cases,performance:performanceRows,limitations:['Physical iOS/Android screen-off not tested','Provider YouTube bot challenge remains external','No production playlist deletion executed']};writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,cases:cases.length,failed:cases.filter(c=>!c.ok),output}));}
