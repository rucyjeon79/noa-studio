import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(path.resolve(process.env.NOA_BROWSER_MODULES,'package.json'));
const {chromium}=require('playwright');
const root='android/device-proof',out='android/chrome-proof';mkdirSync(out,{recursive:true});
const find=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?find(path.join(dir,e.name)):[path.join(dir,e.name)]);
const files=find(root).filter(p=>/\/layout-.*\.json$/.test(p));assert.equal(files.length,4,'Require home/music in both themes');
const cookie=readFileSync(path.join(process.env.RUNNER_TEMP,'noa-android-qa-cookie.txt'),'utf8').trim();
assert.match(cookie,/^PHPSESSID=[A-Za-z0-9,-]{16,128}$/);
const probe=readFileSync('android/app/src/androidTest/assets/pwa-layout-probe.js','utf8');
const browser=await chromium.launch({channel:'chrome',headless:true});const report=[];
try{for(const file of files){
 const expected=JSON.parse(readFileSync(file,'utf8')),name=path.basename(file,'.json');
 const context=await browser.newContext({viewport:{width:expected.viewport.width,height:expected.viewport.height},deviceScaleFactor:expected.viewport.dpr,isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',userAgent:'Mozilla/5.0 (Linux; Android 15; Pixel 2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'});
 await context.addCookies([{name:'PHPSESSID',value:cookie.slice(10),domain:'noastudio.ai.kr',path:'/',secure:true,httpOnly:true}]);
 await context.addInitScript(theme=>{localStorage.setItem('noa-device-theme',theme);sessionStorage.setItem('noa-amt2-fan-2026','1');},expected.theme);
 const page=await context.newPage();page.setDefaultTimeout(45000);
 await page.goto('https://noastudio.ai.kr/',{waitUntil:'load'});
 if(new URL(expected.url).pathname==='/noa-music.php'){
  await page.waitForFunction(()=>document.querySelector('.noa-mobile-nav a[href="/noa-music.php"]'));
  await page.evaluate(()=>document.querySelector('.noa-mobile-nav a[href="/noa-music.php"]').click());
  await page.waitForURL(expected.url,{waitUntil:'load'});
 }
 await page.waitForFunction(()=>window.NoaUI?.getState()&&document.fonts.status==='loaded'&&document.querySelectorAll('.noa-mobile-nav a').length===5);
 await page.waitForTimeout(1500);
 await page.evaluate(theme=>{NoaUI.apply({...NoaUI.getState(),theme});document.querySelector('#noa-amt-fan button[aria-label]')?.click();document.querySelector('[aria-label="AInoa 말풍선 닫기"]')?.click();scrollTo(0,0);},expected.theme);
 await page.waitForTimeout(1000);
 await page.evaluate(readFileSync('android/app/src/androidTest/assets/pwa-images-ready.js','utf8'));
 const actual=await page.evaluate(probe);writeFileSync(path.join(out,name+'.json'),JSON.stringify(actual,null,2));await page.screenshot({path:path.join(out,name+'.png')});
 assert.equal(actual.url,expected.url,name+' route');assert.equal(actual.theme,expected.theme,name+' theme');assert.equal(actual.overflow,false,name+' overflow');
 assert.deepEqual(actual.assets,expected.assets,name+' must use identical live web assets');
 for(const [selector,nodes]of Object.entries(expected.nodes)){
  assert.equal(actual.nodes[selector].length,nodes.length,name+' '+selector+' count');
  for(let i=0;i<nodes.length;i++){
   const a=actual.nodes[selector][i],e=nodes[i];assert.deepEqual(a.style,e.style,name+' '+selector+' CSS');assert.equal(a.text,e.text);assert.equal(a.href,e.href);
   for(const [dimension,value]of Object.entries(e.box))assert(Math.abs(a.box[dimension]-value)<=2,`${name} ${selector} ${dimension}: Chrome ${a.box[dimension]}, APK ${value}`);
  }
 }
 report.push({case:name,chromeMatchesApk:true,viewport:actual.viewport});await context.close();
}}finally{await browser.close();writeFileSync(path.join(out,'comparison.json'),JSON.stringify(report,null,2));}
assert.equal(report.length,4);console.log(JSON.stringify(report));
