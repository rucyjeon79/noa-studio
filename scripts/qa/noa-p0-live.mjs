import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const origin='https://noastudio.ai.kr',width=Number(process.env.NOA_QA_WIDTH||390),out='p0-live-proof';
await fs.mkdir(out,{recursive:true});
const b=await chromium.launch({channel:'chrome'}),c=await b.newContext({viewport:{width,height:900}}),p=await c.newPage(),report={width,urls:[],errors:[],warnings:[],images:[]};
p.on('pageerror',e=>report.errors.push(e.message));
for(const path of ['/','/index.php','/noa-music.php','/noa-world.php','/noa-youtube.php','/noa-my.php']){
 try{const r=await p.goto(origin+path,{waitUntil:'domcontentloaded',timeout:60000});await p.locator('main').waitFor({timeout:20000});report.urls.push({path,status:r.status(),final:p.url(),text:(await p.locator('main').innerText()).slice(0,180),overflow:await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});const visibleImages=await p.locator('img').evaluateAll(async es=>Promise.all(es.filter(i=>{const r=i.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0;}).map(async i=>{try{await i.decode();return{src:i.currentSrc,ok:i.naturalWidth>0};}catch{return{src:i.currentSrc,ok:false};}})));report.images.push({path,visibleImages});await p.screenshot({path:out+'/'+path.replaceAll('/','').replaceAll('.php','')+'-'+width+'.jpg',quality:70});}
 catch(e){report.errors.push(path+':'+e.message.slice(0,250));}
}
const home=await(await p.request.get(origin+'/noa-bridge/home.php')).json();report.home={counts:Object.fromEntries(['stories','covers','playlists'].map(k=>[k,home[k]?.length])),runId:home.runId};
await p.goto(origin+'/',{waitUntil:'domcontentloaded'});await p.locator('#noa-stories a').first().waitFor();
report.home.cards=await p.locator('#noa-stories a,#noa-covers a,#noa-acts a').evaluateAll(es=>({count:es.length,uniqueLinks:new Set(es.map(e=>e.getAttribute('href'))).size}));
report.hero=await p.locator('#noa-hero-video').evaluate(v=>({source:v.currentSrc,currentTime:v.currentTime,readyState:v.readyState,paused:v.paused}));
await p.goto(origin+'/noa-world.php',{waitUntil:'domcontentloaded'});report.world={cards:await p.locator('.world-mv-card').count(),actLinks:await p.locator('a[href*="story="]').count(),text:(await p.locator('main').innerText()).slice(0,1500)};
// External playback previously requested bot verification; do not retry it by default.
report.world.externalPlayback='not retested: previous YouTube bot verification block';
if(width===1280&&process.env.NOA_QA_YOUTUBE_MEDIA==='1'){
 await p.locator('.world-play').first().click();report.world.embed=await p.locator('#world-frame').getAttribute('src');
 try{
  const frame=p.frameLocator('#world-frame');await frame.locator('body').waitFor({timeout:20000});await p.waitForTimeout(5000);
  report.world.mediaText=(await frame.locator('body').innerText()).slice(0,1800);
  if(await frame.locator('video').count())report.world.media=await frame.locator('video').first().evaluate(v=>({time:v.currentTime,duration:v.duration,ready:v.readyState,paused:v.paused,error:v.error?.message}));
 }catch(e){report.world.mediaUnavailable=e.message.slice(0,250);}
 await p.getByRole('button',{name:'영상 닫기',exact:true}).click();report.world.closed=await p.locator('#world-frame').getAttribute('src');
}
const catalog=await(await p.request.get(origin+'/noa-bridge/catalog.php')).json(),audio=catalog.items.filter(x=>x.audioUrl);report.music={publicRecords:catalog.items.length,originalAudioFiles:audio.length,verified:audio.filter(x=>x.audioVerified).length};
await p.goto(origin+'/noa-music.php?genre=kpop-original&act=1',{waitUntil:'domcontentloaded'});
if(audio.length){
 const card=p.locator('.song[data-audio]:not([data-audio=""])').first();await card.locator('.sound-play').click();await p.waitForTimeout(3000);
 report.music.playback=await p.locator('#sound-player').evaluate(v=>({src:v.currentSrc,time:v.currentTime,duration:v.duration,paused:v.paused,ready:v.readyState,error:v.error?.message}));
 report.music.outputSignal=await p.locator('#sound-player').evaluate(async v=>{const ctx=new AudioContext(),source=ctx.createMediaElementSource(v),analyser=ctx.createAnalyser();source.connect(analyser);analyser.connect(ctx.destination);await ctx.resume();await new Promise(r=>setTimeout(r,400));const data=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(data);const rms=Math.sqrt(data.reduce((a,x)=>a+x*x,0)/data.length);await ctx.close();return{rms,nonSilent:rms>0.00001};});
 await p.screenshot({path:out+'/actual-mp3-'+width+'.jpg',quality:75});
 const stream=await p.request.get(audio[0].audioUrl,{headers:{Range:'bytes=0-4095'}});report.music.stream={status:stream.status(),type:stream.headers()['content-type'],range:stream.headers()['content-range'],bytes:(await stream.body()).length};
 await p.locator('#sound-player').evaluate(v=>v.pause());
}
for(const path of ['/noa-app/database/','/noa-app/jukebox/','/noa-app/jukebox/download.php?key=single%3Akpop-original%3A01'])report.urls.push({path,anonymous:(await p.request.get(origin+path)).status()});
await fs.writeFile(out+'/result-'+width+'.json',JSON.stringify(report,null,2));console.log('P0_LIVE '+JSON.stringify(report));await b.close();
if(report.errors.length||report.urls.some(r=>r.status>=500)||!report.music.playback||report.music.playback.error||report.music.playback.paused||!(report.music.playback.time>0)||!report.music.outputSignal?.nonSilent||report.music.stream?.status!==206)process.exitCode=1;
