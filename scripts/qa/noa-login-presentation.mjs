import {chromium} from 'playwright';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const base='https://noastudio.ai.kr',live=process.env.NOA_LOGIN_LIVE==='1';
const out='login-proof/'+(live?'live':'candidate');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
const report=[];
try {
  for (const width of [320,390,1280]) for (const state of live?['ready']:['ready','disabled']) {
    const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
    const errors=[];const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    if(!live) {
      const fixture=readFileSync('login-proof/fixture/'+state+'.html','utf8');
      await context.route(base+'/noa-login.php**',async route=>{
        const response=await route.fetch();assert.equal(response.status(),200);
        // Keep the real production shell and all global styles/scripts to catch overrides.
        const shell=await response.text();
        const main=fixture.match(/<main\b[\s\S]*?<\/main>/)[0];
        const html=shell.replace(/<main\b[\s\S]*?<\/main>/,main).replace('</head>','<link rel="stylesheet" href="/noa-login.css"></head>');
        await route.fulfill({response,body:html});
      });
      await context.route(base+'/noa-login.css**',route=>route.fulfill({contentType:'text/css',body:readFileSync('deploy/noa-login.css')}));
      await context.route(base+'/noa-assets/google-login-g.png',route=>route.fulfill({contentType:'image/png',body:readFileSync('deploy/noa-assets/google-login-g.png')}));
    }
    // Exercise existing destinations without authenticating, creating accounts or submitting credentials.
    const destinations=[];
    await context.route(base+'/bbs/login.php?provider=**',async route=>{destinations.push(route.request().url());await route.fulfill({status:204});});
    const returnTo='/noa-my.php?tab=gifts&from=login';
    await page.goto(base+'/noa-login.php?url='+encodeURIComponent(returnTo),{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.NoaUI?.getState()&&document.querySelector('#noa-account-bar'));
    await page.locator('.noa-social-provider img').evaluate(img=>img.decode());
    const audit=await page.evaluate(()=>{
      const b=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};
      const buttons=[...document.querySelectorAll('#noa-login .noa-social-provider')];
      const body=document.body.getBoundingClientRect(),style=getComputedStyle(document.body);
      return {buttons:buttons.map(n=>({box:b(n),bg:getComputedStyle(n).backgroundColor,color:getComputedStyle(n).color,disabled:n.disabled||false,icons:n.querySelectorAll('img,svg').length,outline:getComputedStyle(n).outlineStyle})),main:b(document.querySelector('#noa-login')),contentLeft:body.left+parseFloat(style.paddingLeft),contentRight:body.right-parseFloat(style.paddingRight),form:b(document.querySelector('.noa-login-form')),overflow:document.documentElement.scrollWidth>innerWidth+1};
    });
    if(audit.overflow){
      const overflow=await page.evaluate(()=>[...document.body.querySelectorAll('*')].filter(n=>n.getBoundingClientRect().right>innerWidth+1).map(n=>({tag:n.tagName,id:n.id,cls:n.className,width:getComputedStyle(n).width,max:getComputedStyle(n).maxWidth,left:n.getBoundingClientRect().left,right:n.getBoundingClientRect().right})).slice(0,20));
      await page.screenshot({path:out+'/overflow-'+width+'.png',fullPage:true});
      console.log('LOGIN_OVERFLOW',JSON.stringify({width,state,audit,overflow}));
    }
    assert.equal(audit.buttons.length,2);assert(!audit.overflow);
    assert.equal(audit.buttons[0].bg,'rgb(255, 255, 255)');assert.equal(audit.buttons[1].bg,'rgb(254, 229, 0)');
    const [g,k]=audit.buttons;assert.equal(g.box.width,k.box.width);assert.equal(g.box.x,k.box.x);assert.equal(g.box.height,k.box.height);
    assert(g.box.height>=52);assert(k.box.y-g.box.bottom>=11);assert(k.box.bottom<audit.form.y);assert(k.box.bottom<900);
    assert(audit.main.width<=560);if(width>760)assert(Math.abs((g.box.x-audit.contentLeft)-(audit.contentRight-g.box.x-g.box.width))<2,'login not centered beside navigation '+JSON.stringify(audit));
    assert(audit.buttons.every(b=>b.icons===1&&b.disabled===(state==='disabled')));
    assert.equal(await page.locator('form[name=flogin]').getAttribute('action'),'/bbs/login_check.php');
    assert.equal(await page.locator('form[name=flogin]').getAttribute('method'),'post');
    assert.equal(await page.locator('#noa-login form[name=flogin] input[name=url]').inputValue(),'/');
    assert.equal(await page.locator('#login_pw').getAttribute('autocomplete'),'current-password');
    if(state==='ready') {
      for(const provider of ['google','kakao']) {
        const link=page.locator('.noa-social-'+provider);
        await link.focus();assert.equal(await link.evaluate(n=>getComputedStyle(n).outlineStyle),'solid');
        const href=new URL(await link.getAttribute('href'),base);
        assert.equal(href.pathname,'/bbs/login.php');assert.equal(href.searchParams.get('provider').toLowerCase(),provider);
        assert.equal(href.searchParams.get('redirect_to_idp'),'1');assert.equal(href.searchParams.get('url'),'/');
      }
    } else assert.equal(await page.locator('.noa-social-option [role=status]').count(),2);
    await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0);});
    await page.screenshot({path:out+'/'+state+'-'+width+'.png',fullPage:true});
    if(state==='ready') {
      for(const provider of ['google','kakao']) {
        const [request]=await Promise.all([
          page.waitForRequest(r=>new URL(r.url()).pathname==='/bbs/login.php'&&r.isNavigationRequest()),
          page.locator('#noa-login .noa-social-'+provider).click()
        ]);
        assert.equal(new URL(request.url()).searchParams.get('provider').toLowerCase(),provider);
      }
      assert.equal(destinations.length,2);
    }
    assert.deepEqual(errors,[]);report.push({width,state,...audit,providerDestinationsVerified:state==='ready'});
    await context.close();
  }
  writeFileSync(out+'/report.json',JSON.stringify({ok:true,live,cases:report,externalOAuthCompleted:false},null,2));
  console.log('LOGIN_PRESENTATION_OK',JSON.stringify({live,cases:report.length}));
} finally {await browser.close();}
