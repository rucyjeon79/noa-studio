import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';

const out='home-runtime-proof';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block',locale:'ko-KR'});
  const page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfinished',async request=>{const response=await request.response();requests.push({path:new URL(request.url()).pathname,type:request.resourceType(),timing:request.timing(),status:response?.status()});});
  await page.addInitScript(()=>{
   window.qaLongTasks=[];
   new PerformanceObserver(list=>window.qaLongTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
  });
  const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
  await page.goto('https://noastudio.ai.kr/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(8000);
  const before=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
  await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
  await page.waitForTimeout(5000);
  const {profile}=await cdp.send('Profiler.stop');
  const after=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
  writeFileSync(out+'/'+width+'.cpuprofile',JSON.stringify(profile));
  const hot=profile.nodes.filter(n=>n.hitCount).sort((a,b)=>b.hitCount-a.hitCount).slice(0,20).map(n=>({function:n.callFrame.functionName,url:n.callFrame.url.split('?')[0],line:n.callFrame.lineNumber+1,hits:n.hitCount}));
  const timing=await page.evaluate(()=>({navigation:performance.getEntriesByType('navigation')[0].toJSON(),paints:performance.getEntriesByType('paint').map(e=>e.toJSON()),resources:performance.getEntriesByType('resource').map(e=>({path:new URL(e.name).pathname,duration:e.duration,size:e.encodedBodySize})),longTasks:window.qaLongTasks,nodes:document.querySelectorAll('*').length}));
  const idle=Object.fromEntries(['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','LayoutCount','RecalcStyleCount'].map(k=>[k,after[k]-before[k]]));
  const report={width,errors,requests,timing,idle,hot};
  writeFileSync(out+'/'+width+'.json',JSON.stringify(report,null,2));
  console.log('HOME_RUNTIME',JSON.stringify({...report,requests:requests.length,timing:{...timing,resources:timing.resources.sort((a,b)=>b.duration-a.duration).slice(0,15),longTasks:timing.longTasks.slice(-10)}}));
  await page.screenshot({path:out+'/'+width+'.png'});
  await context.close();
 }
}finally{await browser.close();}
