import {chromium,webkit} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const live=process.env.NOA_INSTALL_PHASE==='live',base=live?'https://noastudio.ai.kr':'http://127.0.0.1:8078',out='install-proof/'+(live?'live':'candidate');mkdirSync(out,{recursive:true});
const report={environment:live?'production anonymous read-only':'isolated native-auth interface fixture',launch:[],layouts:[],physicalAppleInstallation:false};
const server=live?null:spawn('php',['-S','127.0.0.1:8078','-t','/tmp/noa-pwa-fixture','/tmp/noa-pwa-fixture/router.php'],{stdio:'ignore'});
const profiles={ios:{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',viewport:{width:390,height:844},isMobile:true,hasTouch:true},ipad:{userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',viewport:{width:768,height:1024},isMobile:true,hasTouch:true},android:{userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36',viewport:{width:320,height:800},isMobile:true,hasTouch:true},mac:{userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',viewport:{width:1280,height:900}}};
try{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 try{
  const probe=await browser.newContext();let ready=false;for(let i=0;i<50&&!ready;i++){try{ready=(await probe.request.get(base+'/')).ok();}catch{}if(!ready)await new Promise(r=>setTimeout(r,100));}assert(ready);await probe.close();
  for(const role of live?['guest']:['guest','member','vip'])for(const path of ['/noa-music.php','/bbs/login.php?url=%2Fnoa-music.php','/noa-login.php?url=%2Fnoa-music.php']){
   const c=await browser.newContext({serviceWorkers:'block'});if(!live)await c.addCookies([{name:'qa_role',value:role,url:base}]);await c.addInitScript(()=>sessionStorage.setItem('noa-home-launch-v2','1'));const p=await c.newPage();await p.goto(base+path);await p.waitForURL(base+'/',{timeout:15000});await p.locator('[data-home-section=hero]').waitFor();report.launch.push({role,path,home:true,staleSession:true});await c.close();
  }
  for(const path of ['/','/index.php','/?device=mobile','/noa2.php']){const c=await browser.newContext({serviceWorkers:'block'}),p=await c.newPage();await p.goto(base+path);await p.locator('[data-home-section=hero]').waitFor();assert(!p.url().includes('noa-music.php'));report.launch.push({path,home:true});await c.close();}
  for(const role of live?['guest']:['guest','member','vip']){
   const c=await browser.newContext({serviceWorkers:'block'});if(!live)await c.addCookies([{name:'qa_role',value:role,url:base}]);const p=await c.newPage();await p.goto(base+'/noa-music.php',{referer:base+'/'});await p.waitForLoadState('domcontentloaded');assert.notEqual(new URL(p.url()).pathname,'/');
   await p.goto(base+'/noa-music.php?track=known-deep-link');await p.waitForLoadState('domcontentloaded');assert.notEqual(new URL(p.url()).pathname,'/');report.launch.push({role,deliberateMusicPreserved:true,deepLinkPreserved:true});await c.close();
  }
  const r=await browser.newContext();const manifest=await(await r.request.get(base+'/noa-manifest.json')).json();assert.equal(manifest.start_url,'/');assert.equal(manifest.id,'/noa-music.php');
  const maskable=manifest.icons.filter(i=>i.purpose==='maskable');
  assert(maskable.some(i=>i.sizes==='192x192'));assert(maskable.some(i=>i.sizes==='512x512'));
  const iconPage=await r.newPage();await iconPage.goto(base+'/noa-install.php');
  await iconPage.waitForFunction(()=>document.querySelector('link[rel="apple-touch-icon"]')?.href.includes('icon-touch-180.png'));
  assert.equal(await iconPage.locator('link[rel=manifest]').count(),1);
  const iconSources=[...maskable.map(i=>({src:i.src,size:Number(i.sizes.split('x')[0])})),{src:'/noa-assets/icon-touch-180.png',size:180}];
  report.icons=await iconPage.evaluate(async sources=>{
   const results=[];
   for(const source of sources){
    const img=new Image();img.src=source.src;await img.decode();
    const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let opaque=true;for(let i=3;i<pixels.length;i+=4)if(pixels[i]!==255){opaque=false;break;}
    results.push({src:source.src,width:img.naturalWidth,height:img.naturalHeight,expected:source.size,opaque});
   }
   return results;
  },iconSources);
  for(const icon of report.icons){assert.equal(icon.width,icon.expected);assert.equal(icon.height,icon.expected);assert(icon.opaque,'installation artwork must cover transparent corners');}
  await iconPage.setViewportSize({width:760,height:420});
  await iconPage.setContent('<html><head><meta charset="utf-8"><style>body{margin:24px;background:#14161b;color:#eee;font:15px sans-serif}h1{font-size:22px}main{display:flex;gap:30px;padding-top:22px}figure{margin:0;text-align:center}.icon{width:140px;height:140px;background:white;overflow:hidden}.icon img{width:100%;height:100%;display:block}.circle{border-radius:50%}.rounded{border-radius:26%}.square{border-radius:16%}.old img{width:70%;height:70%;margin:15%}figcaption{margin-top:14px}p{color:#aaa;font-size:13px}</style></head><body><h1>NOA STUDIO · Installation icons</h1><main><figure><div class="icon circle old"><img src="'+base+'/noa-assets/icon-512.png"></div><figcaption>Previous padding</figcaption></figure>'+['circle','rounded','square'].map(shape=>'<figure><div class="icon '+shape+'"><img src="'+base+'/noa-assets/icon-maskable-512.png"></div><figcaption>'+shape+'</figcaption></figure>').join('')+'</main><p>Browser mask preview; physical device installation is not simulated.</p></body></html>');
  await iconPage.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
  await iconPage.screenshot({path:out+'/installation-icons.png'});await iconPage.close();
  const apple=await r.request.get(base+'/noa-download.php',{headers:{'User-Agent':profiles.ios.userAgent},maxRedirects:0});assert.equal(apple.status(),302);assert(apple.headers().location.startsWith('/noa-install.php'));const install=await r.request.get(base+'/noa-install.php');assert.equal(install.status(),200);assert((await install.text()).includes('iPhone · iPad'));report.publicInstallationPage=true;report.appleNeverDownloadsApk=true;await r.close();
  if(!live){
   report.memberHeader=[];
   for(const theme of ['noa-studio','noa-ivory']){const c=await browser.newContext({viewport:{width:320,height:800}});await c.addCookies([{name:'qa_role',value:'vip',url:base}]);await c.addInitScript(theme=>localStorage.setItem('noa-ui-selection',JSON.stringify({theme,language:'ko',radius:'soft',design:'ios'})),theme);const p=await c.newPage();await p.goto(base+'/noa-install.php');await p.locator('#noa-account-bar[data-member=true]').waitFor();const height=await p.locator('#noa-account-bar').evaluate(el=>el.getBoundingClientRect().height);assert(height<=64,'header remains one compact touch row');assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.equal(await p.locator('#noa-account-bar a[href*=logout]').count(),0);assert(await p.locator('.noa-mobile-nav').getByRole('link',{name:'MY',exact:true}).isVisible());await p.screenshot({path:out+'/member-header-'+theme+'-320.png'});report.memberHeader.push({theme,width:320,height,accountInMy:true,noOverflow:true});await c.close();}
   const c=await browser.newContext(),p=await c.newPage();await p.goto(base+'/noa-install.php');await p.evaluate(()=>{const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=async()=>{window.promptCalls=(window.promptCalls||0)+1;};e.userChoice=Promise.resolve({outcome:'dismissed'});window.dispatchEvent(e);});const button=p.locator('[data-noa-install-prompt]');await button.waitFor({state:'visible'});await button.click();await p.getByText('설치를 취소했습니다. 브라우저 메뉴에서 다시 설치할 수 있습니다.',{exact:true}).waitFor();assert.equal(await p.evaluate(()=>window.promptCalls),1);assert(await button.isHidden());report.installPromptCancellation=true;await c.close();
   const app=await browser.newContext();await app.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true}));const ap=await app.newPage();await ap.goto(base+'/noa-install.php');await ap.getByText('이미 NOA STUDIO 앱으로 실행 중입니다.',{exact:true}).waitFor();report.alreadyInstalledState=true;await app.close();
  }
 }finally{await browser.close();}
 for(const engine of live?['chromium']:['chromium','webkit']){
  const browser=engine==='webkit'?await webkit.launch():await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
  try{for(const profile of ['ios','ipad','android','mac'])for(const theme of ['noa-studio','noa-ivory']){
   const c=await browser.newContext({...profiles[profile],serviceWorkers:'block',reducedMotion:'reduce'});await c.addInitScript(({theme,ipad})=>{localStorage.setItem('noa-ui-selection',JSON.stringify({theme,language:'ko',radius:'soft',design:'ios'}));if(ipad)Object.defineProperty(navigator,'maxTouchPoints',{value:5});},{theme,ipad:profile==='ipad'});
   const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/noa-install.php');const platform=profile==='ipad'?'ios':profile;await p.locator('[data-install-platform='+platform+'][data-current]').waitFor();assert.equal(await p.locator('.noa-install-platform').first().getAttribute('data-install-platform'),platform);assert.equal(await p.locator('#noa-account-bar a[href="/noa-install.php"]').count(),1);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   const name=engine+'-'+profile+'-'+theme;await p.screenshot({path:out+'/'+name+'-install.png'});await p.locator('[data-install-platform='+platform+']').getByRole('link',{name:'홈에서 설치 안내 보기',exact:true}).click();const dialog=p.getByRole('dialog');await dialog.waitFor();assert.equal(new URL(p.url()).pathname,'/');assert.equal(new URL(p.url()).search,'');assert.equal(await p.locator('link[rel=manifest]').count(),1);assert.equal(await p.locator('meta[name=apple-mobile-web-app-capable]').first().getAttribute('content'),'yes');assert.equal(await p.locator('link[rel=apple-touch-icon]').count(),1);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:out+'/'+name+'-guide.png'});await p.getByRole('button',{name:'안내 닫기',exact:true}).click();await dialog.waitFor({state:'hidden'});assert(await p.locator('[data-home-section=hero]').isVisible());assert.deepEqual(errors,[]);report.layouts.push({engine,profile,theme,installVisible:true,cleanHomeUrl:true,guideCloses:true,noOverflow:true,pageErrors:errors});await c.close();
  }}finally{await browser.close();}
 }
}finally{writeFileSync(out+'/report.json',JSON.stringify(report,null,2));server?.kill();}
console.log('HOME_ENTRY_AND_INSTALL_OK',JSON.stringify({launch:report.launch.length,layouts:report.layouts.length,live}));
