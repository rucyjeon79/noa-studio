/** N80-owned, bounded browser connection. Private JSON pipes only; no debug port. */
import {createInterface} from 'node:readline';
import {createRequire} from 'node:module';
import {createHash,randomBytes} from 'node:crypto';
const require=createRequire(process.env.N80_BROWSER_PACKAGE+'/package.json');
const {chromium}=require('playwright');
const lines=createInterface({input:process.stdin,crlfDelay:Infinity})[Symbol.asyncIterator]();
const read=async()=>{const v=await lines.next();if(v.done||v.value.length>6000000)throw Error('pipe_closed');return JSON.parse(v.value);};
const emit=v=>process.stdout.write(JSON.stringify(v)+'\n');
const hosts=new Set(['gemini.google.com','accounts.google.com','labs.google','labs.google.com','flow.google.com']);
const allowed=url=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&hosts.has(u.hostname);}catch{return false;}};
const targets={gemini:'https://gemini.google.com/gem/21f716bf5427/ed7d123a536aafda',flow:'https://flow.google.com/'};
let browser;
try{
 const init=await read();
 const deadline=Math.min(Date.now()+900000,Number(init.expiresAt)*1000||Date.now()+120000);
 browser=await chromium.launch({channel:'chrome',headless:false,chromiumSandbox:true,args:['--disable-dev-shm-usage'],timeout:45000});
 const context=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:false,serviceWorkers:'block',...(init.storageState?{storageState:init.storageState}:{})});
 let page=await context.newPage();
 context.on('page',p=>{page=p;p.on('close',()=>{page=context.pages().filter(p=>!p.isClosed()).at(-1);});});
 await context.route('**/*',route=>{const r=route.request();return r.isNavigationRequest()&&r.frame()===r.frame().page().mainFrame()&&!allowed(r.url())?route.abort():route.continue();});
 if(init.mode==='probe'){
  const nonce=randomBytes(16).toString('hex');
  await page.setContent('<canvas width="40" height="40"></canvas>');
  const js=await page.evaluate(n=>{const c=document.querySelector('canvas').getContext('2d');c.fillStyle='#bc924f';c.fillRect(0,0,40,40);return {nonce:n,pixel:[...c.getImageData(2,2,1,1).data]};},nonce);
  if(js.nonce!==nonce||js.pixel.join(',')!=='188,146,79,255')throw Error('browser_script_failed');
  const shot=await page.screenshot({type:'jpeg',quality:50});
  const providers={};
  for(const [provider,url] of Object.entries(targets)){
   try{const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:40000});providers[provider]={reachable:!!r&&r.status()<400&&allowed(page.url()),status:r?.status()??null,host:new URL(page.url()).hostname};}
   catch{providers[provider]={reachable:false};}
  }
  emit({type:'proof',browserVersion:browser.version(),sandbox:true,scriptVerified:true,canvasVerified:true,screenshotSha256:createHash('sha256').update(shot).digest('hex'),providers,authenticated:false,productionReady:false});
 }else{
  await page.goto(targets.gemini,{waitUntil:'domcontentloaded',timeout:45000});
  let ack=0;
  while(Date.now()<deadline+20000){
   if(!page||page.isClosed())throw Error('browser_closed');
   if(page.url()==='about:blank')await page.waitForURL(u=>allowed(u.href),{timeout:15000});
   const actual=page.url();if(!allowed(actual))throw Error('navigation_blocked');
   const u=new URL(actual),url=u.origin+u.pathname;
   const image='data:image/jpeg;base64,'+(await page.screenshot({type:'jpeg',quality:50,timeout:15000})).toString('base64');
   emit({type:'exchange',ack,frame:{url,image}});
   const command=await read();
   if(command.stop||Date.now()>=deadline){
    if(command.save){const storageState=await context.storageState({indexedDB:true});emit({type:'profile',storageState});}
    else emit({type:'closed'});
    break;
   }
   const input=command.input;
   if(input&&input.seq>ack){
    if(input.seq!==ack+1)throw Error('input_sequence');
    const e=input.event;
    if(e.kind==='click')await page.mouse.click(e.x,e.y);
    else if(e.kind==='type')await page.keyboard.insertText(e.text);
    else if(e.kind==='key')await page.keyboard.press(e.key);
    else if(e.kind==='scroll')await page.mouse.wheel(0,e.y);
    else if(e.kind==='navigate'&&targets[e.target])await page.goto(targets[e.target],{waitUntil:'domcontentloaded',timeout:45000});
    else throw Error('input_rejected');
    ack=input.seq;
   }
   await new Promise(r=>setTimeout(r,2500));
  }
 }
}catch{emit({type:'error',error:'browser_connection_failed'});process.exitCode=1;}
finally{await browser?.close().catch(()=>{});process.stdin.destroy();}
