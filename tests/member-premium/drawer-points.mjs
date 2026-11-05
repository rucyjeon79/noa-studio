import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Render the production account drawer and wallet with a synthetic member.
// No authentication, purchases, point transfers or production requests occur.
export async function verifyDrawerPoints(browser,out,report){
 const source=readFileSync('deploy/noa-ui.js','utf8');
 const registry=source.slice(source.indexOf('const icons='),source.indexOf('let access='));
 const decorators=source.slice(source.indexOf('function icon(key)'),source.indexOf('function navItem('));
 const membershipListener=source.split('\n').find(l=>l.startsWith("window.addEventListener('noa-membership-status'"));
 const start=source.indexOf('function wideShell(side)');
 const account=source.slice(start,source.indexOf(' const searchBox=',start))+'}';
 const wallet=readFileSync('deploy/noa-membership.php','utf8').match(/<main\b[\s\S]*?<\/main>/)[0].replace(/<\?[\s\S]*?\?>/g,'');
 const themes=JSON.parse(readFileSync('deploy/noa-design.json','utf8')).themes;
 for(const width of [320,390,1440])for(const theme of themes){
  const context=await browser.newContext({viewport:{width,height:900},locale:'ko-KR',serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[],writes=[];let walletReads=0;
  page.on('pageerror',e=>errors.push(e.message));
  const tokens=Object.entries(theme.tokens).map(([k,v])=>'--noa-'+k+':'+v).join(';');
  const frame=body=>'<!doctype html><html lang="ko" class="noa-shell-wide noa-member-ui" data-noa-precision="true" data-noa-style="starlight" data-noa-theme="'+theme.id+'" style="'+tokens+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+['noa-ui.css','noa-starlight.css','noa-account.css','noa-membership-wallet.css','noa-member-surfaces.css'].map(n=>'<link rel="stylesheet" href="/'+n+'">').join('')+'</head><body class="noa-page">'+body+'</body></html>';
  await context.route('**/*',r=>{
   const req=r.request(),u=new URL(req.url());
   if(req.method()!=='GET'){writes.push(u.pathname);return r.abort();}
   if(u.origin!=='https://member.fixture')return r.abort();
   if(u.pathname==='/noa-bridge/membership.php'){
    walletReads++;
    return r.fulfill({json:{ok:true,member:true,level:4,name:'별무리 VIP',balance:3740,enabled:true,remainingDays:12,grant:{status:'active',until:1800000000},autoRenew:{values:{enabled:false}},ledger:[],payment:{enabled:false},topups:[]}});
   }
   if(u.pathname==='/noa-membership.php')return r.fulfill({contentType:'text/html',body:frame(wallet+'<script src="/noa-membership.js"></script>')});
   if(/^\/noa-[\w-]+\.(css|js)$/.test(u.pathname))return r.fulfill({contentType:u.pathname.endsWith('.css')?'text/css':'text/javascript',body:readFileSync('deploy'+u.pathname)});
   return r.fulfill({contentType:'text/html',body:frame('<dialog id="noa-menu-drawer" class="noa-menu-drawer" open><a class="noa-logo" href="/">NOA STUDIO</a></dialog>')});
  });
  await page.goto('https://member.fixture/');
  await page.addScriptTag({content:'(()=>{const root=document.documentElement,g5=false;const access={member:true},remote={member:true,displayName:"별무리"};let drawerMember=null;function dismiss(){}function refreshNavigation(){}'+registry+decorators+membershipListener+account+';window.dispatchEvent(new CustomEvent("noa-membership-status",{detail:{member:true,balance:3740,name:"별무리 VIP"}}));wideShell(document.querySelector("dialog"));})();'});
  const points=page.locator('[data-drawer-action=points]');
  assert.equal(await points.textContent(),'포인트·이용권');
  assert.equal(await points.getAttribute('href'),'/noa-membership.php');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('noa-membership-status',{detail:{member:true,balance:123456789,name:'별무리 VIP'}})));
  assert.equal(await points.textContent(),'포인트·이용권','balance updates must not expose a second line');
  assert.equal(walletReads,0,'the menu must not request wallet details');
  const rows=await page.locator('.noa-drawer-links>a:visible').evaluateAll(links=>links.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
  for(let i=0;i<rows.length;i++){assert(rows[i].h>=44);assert.equal(rows[i].x,rows[i%2].x);assert.equal(rows[i].y,rows[i-i%2].y);}
  if(width===390)await page.screenshot({path:out+'/drawer-points-'+theme.id+'.png'});
  await points.click();await page.waitForURL('**/noa-membership.php');
  await page.waitForFunction(()=>document.querySelector('#membership-balance')?.textContent==='3,740P');
  assert.equal(walletReads,1);assert.match(await page.locator('#membership-until').textContent(),/12일 남음/);
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
  report.fixtures.push({key:'drawer-points',width,theme:theme.id,balanceHiddenInMenu:true,walletOpened:true,walletBalance:3740,writes:0});
  await context.close();
 }
 console.log('MEMBER_DRAWER_POINTS_OK');
}
