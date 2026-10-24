import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const origin='https://noastudio.ai.kr';
const output=resolve(process.env.NOA_SITEMAP_QA_OUTPUT||'qa/sitemap/verified.json');
const cases=[],links=[],screenshots=[];let browser;
const sha=value=>createHash('sha256').update(value).digest('hex');
function check(name,ok,evidence={}){cases.push({name,ok:!!ok,...evidence});}
function requireCheck(name,ok,evidence={}){check(name,ok,evidence);if(!ok)throw Error(name);}
// Immutable SHA-256 of the original HOST sections, before the sitemap-only patch.
const originalSections={hero:'56a639f76f10fd33e365888ac0135b64754163f2c3de3865ef9bbecb8b854ba9',recommendations:'1e054c6a288e4fc643f25d8daa731786c6e8f25e71d22d654b010b43816adb49',ep:'8b72aefd89055a7c820d562051614fcdbcc43d87c71fff62c1974cab41ee3813',stories:'325745576988668c2d3fbb898b95720f920eef7bb2216badd6fb8d9dadc7e496',covers:'8d6b5a4a7969b6925521334116bb53baf6ff6964b28af77cd6a982e11680fb5f',playlists:'1fb12a298d05246659af1dc4bd12d63401db04183156fb0c6e31301c395db8dc',community:'3d894da512f2cbdd7e37c34260cbcad810d7923e5de038fc681e75b3081bdbbc'};
const requiredIds=['home','youtube','world','music','my','catalog','settings','download','original','ep','story','cover','act1','act2','act3','act4','login','register','password','search'];
const privateIds=['libraryAdmin','editor','categoryOrder','jukebox','catalogAdmin','recovery','youtubeAdmin','aiLab','themeAdmin','database','taxonomy','members','boards','system','nativeTheme','playlists','profile'];
const blockedPath=/\/(?:adm(?:\/|$)|noa2\.php|bbs\/logout\.php|noa-bridge\/|noa-deploy-center\.php)|(?:api|health)\.php$|\.extend\.php$/i;
// Native GnuBoard error responses may use HTTP 200 plus an alert and history.back().
// Inspect literal alert messages only, not conditional validation scripts on valid forms.
function nativeErrors(body){return [...body.matchAll(/\balert\s*\(\s*(['"])((?:\\.|(?!\1)[\s\S])*?)\1\s*\)/g)].map(m=>m[2]).filter(s=>/(존재하지 않는|존재하지 않습니다|등록된 내용이 없|권한이 없|접근할 수 없|읽을 권한|회원만|잘못된 접근)/.test(s));}
mkdirSync(dirname(output),{recursive:true});
try{
 const {chromium}=createRequire(process.env.NOA_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright');
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:900}});
 // The suite never logs in or submits a form. Abort unexpected browser writes.
 await context.route('**/*',route=>['GET','HEAD'].includes(route.request().method())?route.continue():route.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto(origin+'/noa-sitemap.php',{waitUntil:'domcontentloaded',timeout:90000});
 requireCheck('guest_sitemap_http_200',response?.status()===200,{status:response?.status()});
 check('role_response_not_shared_cacheable',/private/.test(response.headers()['cache-control']||'')&&/no-store/.test(response.headers()['cache-control']||'')&&/cookie/i.test(response.headers()['vary']||''));
 requireCheck('sitemap_heading',await page.locator('main h1').textContent()==='사이트맵');
 const exposed=await page.locator('main .noa-site-map-link').evaluateAll(nodes=>nodes.map(a=>({id:a.dataset.noaRoute,href:a.getAttribute('href'),label:a.querySelector('strong')?.textContent})));
 links.push(...exposed);
 requireCheck('all_expected_public_routes_exist',requiredIds.every(id=>exposed.some(a=>a.id===id)),{missing:requiredIds.filter(id=>!exposed.some(a=>a.id===id))});
 check('guest_cannot_discover_private_routes',!exposed.some(a=>privateIds.includes(a.id))&&await page.locator('#map-admin').count()===0);
 const invalid=exposed.filter(a=>{try{const u=new URL(a.href,origin);return u.origin!==origin||blockedPath.test(u.pathname)||!a.href.startsWith('/');}catch{return true;}});
 requireCheck('only_safe_same_origin_navigation',invalid.length===0,{invalid});
 check('route_ids_unique',new Set(exposed.map(a=>a.id)).size===exposed.length);
 const requests=[...new Set(exposed.map(a=>{const u=new URL(a.href,origin);u.hash='';return u.href;}))];
 let index=0;const results=[];
 await Promise.all(Array.from({length:2},async()=>{while(index<requests.length){const url=requests[index++];try{
  const r=await context.request.get(url,{timeout:90000,maxRetries:1}),body=await r.text(),final=new URL(r.url()),expected=new URL(url);
  const native=/\/bbs\/(?:board|content)\.php$/.test(expected.pathname);
  const queryKey=expected.pathname.endsWith('/board.php')?'bo_table':'co_id';
  const nativeValid=!native||(final.pathname===expected.pathname&&final.searchParams.get(queryKey)===expected.searchParams.get(queryKey)&&nativeErrors(body).length===0);
  const ok=r.status()===200&&final.origin===origin&&nativeValid;
  results.push({url,status:r.status(),finalUrl:r.url(),ok,...(native?{nativeErrors:nativeErrors(body)}:{})});
 }catch(e){results.push({url,ok:false,error:e.message.split('\n')[0]});}}}));
 results.sort((a,b)=>a.url.localeCompare(b.url));
 check('all_exposed_destinations_http_and_native_content_valid',results.every(r=>r.ok),{checked:results.length,results});
 check('guest_runtime_clean',errors.length===0,{errors});
 const home=await context.request.get(origin+'/',{timeout:90000}),homeBody=await home.text();
 check('home_http_200',home.status()===200,{status:home.status()});
 for(const [name,expected] of Object.entries(originalSections)){
  const section=homeBody.match(new RegExp('<section\\b[^>]*data-home-section="'+name+'"[^>]*>[\\s\\S]*?<\\/section>'))?.[0];
  check('original_home_'+name+'_sha256_preserved',!!section&&sha(section)===expected,{expected,actual:section?sha(section):null});
 }
 check('home_links_to_sitemap',/data-home-section="sitemap"[\s\S]*?href="\/noa-sitemap\.php"/.test(homeBody));
 await context.close();
 // Reuse the approved NoaUI themes; check card geometry and navigation reachability.
 for(const theme of ['noa-studio','noa-ivory'])for(const [width,height] of [[320,900],[360,900],[390,900],[430,900],[1440,1000],[844,390]]){
  const c=await browser.newContext({viewport:{width,height}});
  await c.addInitScript(selection=>localStorage.setItem('noa-ui-selection',JSON.stringify(selection)),{theme,language:'ko',design:'ios',radius:'soft'});
  await c.route('**/*',r=>['GET','HEAD'].includes(r.request().method())?r.continue():r.abort());
  const p=await c.newPage(),runtimeErrors=[];p.on('pageerror',e=>runtimeErrors.push(e.message));
  try{
   const r=await p.goto(origin+'/noa-sitemap.php',{waitUntil:'domcontentloaded',timeout:90000});
   await p.locator('main .noa-site-map-link').first().waitFor({state:'visible'});
   await p.waitForFunction(expected=>document.documentElement.dataset.noaTheme===expected&&!!document.querySelector('.noa-site-map-link svg')&&getComputedStyle(document.querySelector('.noa-site-map-grid')).display==='grid',theme,{timeout:15000});
   const geometry=await p.evaluate(()=>{
    const cards=[...document.querySelectorAll('main .noa-site-map-link')].map(a=>{const b=a.getBoundingClientRect();return {id:a.dataset.noaRoute,x:b.x,y:b.y,width:b.width,height:b.height};});
    const rowMismatch=[];for(let i=0;i<cards.length;i++)for(let j=i+1;j<cards.length;j++)if(Math.abs(cards[i].y-cards[j].y)<1&&Math.abs(cards[i].height-cards[j].height)>1)rowMismatch.push([cards[i].id,cards[j].id]);
    return {overflow:document.documentElement.scrollWidth-innerWidth,small:cards.filter(b=>b.width<44||b.height<44),rowMismatch,count:cards.length};
   });
   const last=p.locator('main .noa-site-map-link').last();await last.scrollIntoViewIfNeeded();
   const reachable=await last.evaluate(a=>{const b=a.getBoundingClientRect(),x=Math.max(0,Math.min(innerWidth-1,b.x+b.width/2)),y=Math.max(0,Math.min(innerHeight-1,b.y+b.height/2));return b.bottom>0&&b.top<innerHeight&&a.contains(document.elementFromPoint(x,y));});
   check('approved_theme_layout_'+theme+'_'+width+'x'+height,r?.status()===200&&geometry.overflow<=1&&!geometry.small.length&&!geometry.rowMismatch.length&&reachable&&runtimeErrors.length===0,{...geometry,lastCardReachable:reachable,errors:runtimeErrors});
   await p.evaluate(()=>scrollTo(0,0));const path=resolve(dirname(output),'sitemap-'+theme+'-'+width+'x'+height+'.png');await p.screenshot({path,fullPage:false});screenshots.push(path);
  }catch(e){check('approved_theme_layout_'+theme+'_'+width+'x'+height,false,{error:e.message.split('\n')[0]});}
  finally{await c.close();}
 }
}catch(e){check('suite_failure',false,{error:e.message.split('\n')[0]});}
finally{
 if(browser)await browser.close();
 const report={ok:cases.length>0&&cases.every(c=>c.ok),origin,createdAt:new Date().toISOString(),cases,exposedLinks:links,screenshots,limitations:['Guest-only browser verification; member and superadmin route filtering requires PHP fixture tests.','No form submission, upload, playback, logout or production data mutation executed.']};
 writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,cases:cases.length,failed:cases.filter(c=>!c.ok).map(c=>c.name),output}));if(!report.ok)process.exitCode=1;
}
