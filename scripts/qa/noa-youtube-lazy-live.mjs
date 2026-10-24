import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const origin='https://noastudio.ai.kr';
const output=resolve('qa/finish-live/youtube-lazy');
const baseline=JSON.parse(readFileSync(resolve('tests/youtube/public-detail-baseline.json'),'utf8'));
const before=JSON.parse(readFileSync(resolve('tests/youtube/performance-before.json'),'utf8'));
const ids=Object.keys(baseline).sort(),cases=[],samples=[],representatives=[],screenshots=[];
const officialActs=['QEQ_XYFJduk','NdSuzwrbQPs','07Ibxrg3lSc'];
const sha=value=>createHash('sha256').update(value).digest('hex');
const median=values=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)];};
let browser,phase='baseline',failure=null,canonical=null;
function check(name,ok,evidence={}){cases.push({name,ok:!!ok,...evidence});if(!ok)throw Error(name);}
function sameIds(actual){return JSON.stringify([...new Set(actual)].sort())===JSON.stringify(ids)&&actual.length===ids.length;}
function detailMatches(id,data){const old=baseline[id];return data?.ok===true&&data.videoId===id&&typeof data.description==='string'&&typeof data.lyrics==='string'&&sha(data.description)===old.description&&sha(data.lyrics)===old.lyrics&&Buffer.byteLength(data.description)===old.descriptionBytes&&Buffer.byteLength(data.lyrics)===old.lyricsBytes;}
function chooseRepresentatives(preferred){const chosen=new Set([preferred]);const groups=[ids.filter(id=>baseline[id].descriptionBytes>0&&baseline[id].lyricsBytes>0),ids.filter(id=>baseline[id].descriptionBytes>0&&baseline[id].lyricsBytes===0),ids.filter(id=>baseline[id].descriptionBytes===0&&baseline[id].lyricsBytes>0),ids.filter(id=>baseline[id].descriptionBytes===0&&baseline[id].lyricsBytes===0)];for(const group of groups)for(let i=0;i<Math.min(6,group.length);i++)chosen.add(group[Math.floor(i*group.length/Math.min(6,group.length))]);for(let i=0;chosen.size<24&&i<ids.length;i++)chosen.add(ids[Math.floor(i*ids.length/24)%ids.length]);for(const id of ids){if(chosen.size>=24)break;chosen.add(id);}return [...chosen].slice(0,24);}
async function guardedContext(options={}){const context=await browser.newContext(options);await context.route('**/*',route=>['GET','HEAD'].includes(route.request().method())?route.continue():route.abort('blockedbyclient'));await context.route('https://www.youtube.com/embed/**',route=>route.abort('blockedbyclient'));return context;}
async function snapshot(page){return page.evaluate(()=>({ids:[...document.querySelectorAll('.yt-watch[data-video]')].map(e=>e.dataset.video),detailCount:Object.keys(window.NoaVideoDetails||{}).length}));}
mkdirSync(output,{recursive:true});
try{
 check('baseline_586_video_identities',ids.length===586);
 check('baseline_three_samples_per_profile',[false,true].every(mobile=>before.filter(row=>row.mobile===mobile).length===3));
 const {chromium}=createRequire(process.env.NOA_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright');
 browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 phase='public_identity';
 const context=await guardedContext(),api=context.request;
 const initial=await api.get(origin+'/noa-youtube.php',{timeout:60000,maxRetries:0});
 check('public_page_http_200',initial.status()===200);
 const html=await initial.text();
 const actualIds=[...html.matchAll(/class="yt-watch"[^>]*data-video="([A-Za-z0-9_-]{11})"/g)].map(match=>match[1]);
 check('all_586_initial_cards_preserved',sameIds(actualIds),{count:actualIds.length,identitySha256:sha(JSON.stringify([...actualIds].sort()))});
 check('initial_detail_json_is_empty',/window\.NoaVideoDetails=\{\}/.test(html));
 const rowsMatch=html.match(/const rows=(\[[\s\S]*?\]),search=document/);
 check('canonical_mapping_read_model_present',!!rowsMatch);
 const rows=JSON.parse(rowsMatch[1]);
 canonical=rows.find(row=>baseline[row.key]?.lyricsBytes>0&&baseline[row.key]?.descriptionBytes>0&&/^[a-f0-9]{64}$/.test(row.orderKey||''));
 check('canonical_mapped_video_has_original_lyrics',!!canonical);
 phase='detail_hashes';
 for(const id of chooseRepresentatives(canonical.key)){
  const response=await api.get(origin+'/noa-youtube.php?detail='+encodeURIComponent(id),{timeout:45000,maxRetries:0});
  check('detail_http_'+id,response.status()===200,{status:response.status()});
  check('detail_no_store_'+id,/no-store/.test(response.headers()['cache-control']||''));
  const data=await response.json();check('original_description_and_lyrics_sha_'+id,detailMatches(id,data));
  representatives.push({videoId:id,descriptionSha256:sha(data.description),lyricsSha256:sha(data.lyrics),descriptionBytes:Buffer.byteLength(data.description),lyricsBytes:Buffer.byteLength(data.lyrics)});
 }
 check('twenty_four_representatives_verified',representatives.length===24);
 check('empty_original_lyrics_represented',representatives.some(row=>row.lyricsBytes===0));
 check('nonempty_original_lyrics_represented',representatives.some(row=>row.lyricsBytes>0));
 for(const id of officialActs){const response=await api.get(origin+'/noa-youtube.php?detail='+id,{timeout:45000,maxRetries:0});check('official_act_detail_hidden_'+id,response.status()===404,{status:response.status()});}
 const malformed=await api.get(origin+'/noa-youtube.php?detail=invalid',{timeout:45000,maxRetries:0});check('malformed_detail_id_400',malformed.status()===400,{status:malformed.status()});
 await context.close();
 phase='performance_samples';
 for(const mobile of [false,true])for(let sample=0;sample<3;sample++){
  const ctx=await guardedContext({viewport:{width:mobile?390:1440,height:900}}),page=await ctx.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  if(mobile){const cdp=await ctx.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:200000,uploadThroughput:90000});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
  const response=await page.goto(origin+'/noa-youtube.php',{waitUntil:'domcontentloaded',timeout:120000});
  check(`sample_http_${mobile}_${sample}`,response?.status()===200);
  const body=await response.body(),initialState=await snapshot(page);
  check(`sample_empty_detail_cache_${mobile}_${sample}`,initialState.detailCount===0);
  check(`sample_identities_${mobile}_${sample}`,sameIds(initialState.ids));
  check(`sample_no_page_errors_${mobile}_${sample}`,errors.length===0,{count:errors.length});
  const timings=await page.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];return{ttfb:n.responseStart-n.requestStart,dcl:n.domContentLoadedEventEnd-n.startTime,dom:document.querySelectorAll('*').length,wireBytes:n.encodedBodySize,transferBytes:n.transferSize,decodedBytes:n.decodedBodySize};});
  check(`sample_valid_measurement_${mobile}_${sample}`,timings.dcl>0&&timings.decodedBytes>0&&timings.wireBytes>0);
  samples.push({mobile,sample,...timings,responseBodyBytes:body.length,profile:mobile?{width:390,height:900,latencyMs:80,downloadBytesPerSecond:200000,uploadBytesPerSecond:90000,cpuRate:4}:{width:1440,height:900,network:'unthrottled',cpuRate:1}});
  await ctx.close();
 }
 phase='actual_ui';
 for(const mobile of [false,true]){
  const ctx=await guardedContext({viewport:{width:mobile?390:1440,height:900}}),page=await ctx.newPage(),errors=[],detailRequests=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{const url=new URL(request.url());if(url.origin===origin&&url.pathname==='/noa-youtube.php'&&url.searchParams.has('detail'))detailRequests.push(url.searchParams.get('detail'));});
  const response=await page.goto(origin+'/noa-youtube.php?track='+encodeURIComponent(canonical.key),{waitUntil:'domcontentloaded',timeout:90000});check('ui_http_'+mobile,response?.status()===200);
  const button=page.locator('.yt-watch[data-video="'+canonical.key+'"]');await button.waitFor({state:'visible',timeout:15000});await button.click();
  check('ui_select_does_not_prefetch_'+mobile,detailRequests.length===0);
  const frame=await page.locator('#yt-frame').getAttribute('src');check('ui_keeps_existing_video_embed_'+mobile,frame?.startsWith('https://www.youtube.com/embed/'+canonical.key+'?'));
  await page.locator('#youtube-description summary').click();
  await page.waitForFunction(id=>window.NoaVideoDetails?.[id]?.videoId===id,canonical.key,{timeout:45000});
  check('ui_description_open_independently_'+mobile,await page.locator('#youtube-description').evaluate(e=>e.open)&&!await page.locator('#youtube-lyrics').evaluate(e=>e.open));
  const description=await page.locator('#youtube-description-text').textContent();check('ui_description_original_sha_'+mobile,sha(description)===baseline[canonical.key].description);
  await page.locator('#youtube-lyrics summary').click();
  check('ui_both_details_can_remain_open_'+mobile,await page.locator('#youtube-description').evaluate(e=>e.open)&&await page.locator('#youtube-lyrics').evaluate(e=>e.open));
  const lyrics=await page.locator('#youtube-lyrics-text').textContent();check('ui_lyrics_original_sha_'+mobile,sha(lyrics)===baseline[canonical.key].lyrics);
  await page.locator('#youtube-description summary').click();check('ui_closing_description_keeps_lyrics_open_'+mobile,!await page.locator('#youtube-description').evaluate(e=>e.open)&&await page.locator('#youtube-lyrics').evaluate(e=>e.open));
  check('ui_one_shared_detail_read_'+mobile,detailRequests.length===1&&detailRequests[0]===canonical.key,{requests:detailRequests.length});
  check('ui_detail_does_not_reload_iframe_'+mobile,await page.locator('#yt-frame').getAttribute('src')===frame);
  check('ui_no_page_errors_'+mobile,errors.length===0,{count:errors.length});
  const image=resolve(output,mobile?'mobile.png':'desktop.png');await page.screenshot({path:image,fullPage:false});screenshots.push(image);
  await ctx.close();
 }
}catch(error){failure={phase,code:String(error.message||error).split('\n')[0].slice(0,180)};}
finally{if(browser)await browser.close().catch(()=>{});}
const comparisons=[false,true].map(mobile=>{const old=before.filter(row=>row.mobile===mobile),after=samples.filter(row=>row.mobile===mobile);if(after.length!==3)return{mobile,complete:false};const result={mobile,complete:true,before:{},after:{},changePercent:{}};for(const field of ['dcl','ttfb','wireBytes','decodedBytes','transferBytes','dom']){result.before[field]=median(old.map(row=>row[field]));result.after[field]=median(after.map(row=>row[field]));result.changePercent[field]=result.before[field]?Math.round((result.after[field]/result.before[field]-1)*10000)/100:null;}return result;});
const ok=!failure&&cases.every(row=>row.ok)&&samples.length===6;
const report={ok,checkedAt:new Date().toISOString(),sourceCommit:process.env.GITHUB_SHA||null,origin,baselineVideoCount:ids.length,canonicalMappedVideoId:canonical?.key||null,representatives,cases,performanceBefore:before,performanceAfter:samples,comparisons,screenshots,providerPlaybackVerified:false,providerEmbedRequests:'intentionally_aborted_without_retry',failure};
writeFileSync(resolve(output,'verified.json'),JSON.stringify(report,null,2)+'\n');
if(!ok){console.error('NOA_YOUTUBE_LAZY_LIVE_FAIL '+(failure?.phase||'checks')+' '+(failure?.code||'verification_failed'));process.exitCode=1;}
else console.log('NOA_YOUTUBE_LAZY_LIVE_PASS 586 identities; 24 original detail hashes; desktop/mobile UI; six baseline-matched samples; provider playback unverified');
