import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const base='https://noastudio.ai.kr',out='room-theme-proof/menu-surfaces';
mkdirSync(out,{recursive:true});
// Discover actual navigation from the same role-aware registries used by the site.
const source="define('NOA_SITEMAP_REGISTRY_ONLY',true);require 'deploy/noa-sitemap.php';require 'deploy/noa-workspace.php';$g=noa_sitemap_registry();foreach(noa_workspace_groups() as $k=>$v){foreach($v['routes'] as &$r)$r[]='admin';unset($r);$g['workspace-'.$k]=$v;}echo json_encode($g);";
const groups=JSON.parse(execFileSync('php',['-r',source],{encoding:'utf8'}));
const registry=Object.values(groups).flatMap(g=>g.routes.map(r=>({section:g.title,label:r[1],href:r[3],role:r[5]})));
const publicLinks=[...new Set([...registry.filter(r=>['public','guest'].includes(r.role)).map(r=>r.href),'/noa-sitemap.php','/shop/cart.php'])];
const results=[],errors=[];
writeFileSync(out+'/registry.json',JSON.stringify(registry,null,2));
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
try{
 await Promise.all([390,1440].map(async width=>{
  const c=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',locale:'ko-KR'});
  try{
   for(const href of publicLinks){
    const page=await c.newPage();page.setDefaultTimeout(12000);
    const alerts=[];page.on('dialog',async d=>{alerts.push(d.message());await d.dismiss();});
    try{
     let chosen='noa-ivory';
     await page.route('**/*',route=>['media'].includes(route.request().resourceType())?route.abort():route.continue());
     await page.addInitScript(()=>{localStorage.setItem('noa-ui-selection-v2',JSON.stringify({theme:sessionStorage.getItem('noa-menu-audit')||'noa-ivory'}));});
     for(const theme of ['noa-ivory','noa-studio']){
      const requested=new URL(href,base);assert.equal(requested.origin,base);
      if(chosen!==theme){await page.evaluate(theme=>sessionStorage.setItem('noa-menu-audit',theme),theme);chosen=theme;}
      const response=await page.goto(requested.href,{referer:base+'/noa-sitemap.php',waitUntil:'domcontentloaded',timeout:40000});
      const actual=new URL(page.url()),status=response?.status()||0;
      const gate=(/로그인|회원만|접근 권한|이용권/.test(alerts.join(' '))||[401,403].includes(status)||(/login\.php$/.test(actual.pathname)&&actual.pathname!==requested.pathname));
      if(gate){results.push({width,theme,href,actual:actual.pathname,status,access:'gate'});break;}
      assert(status>=200&&status<400,'HTTP '+status);
      await page.waitForFunction(expected=>document.documentElement.dataset.noaTheme===expected,theme,{timeout:10000});
      const shape=await page.evaluate(()=>{
       const root=document.documentElement,style=getComputedStyle(root);
       const main=document.querySelector('main,#container,.new_win')||document.body;
       return {theme:root.dataset.noaTheme,scheme:style.colorScheme,overflow:root.scrollWidth-root.clientWidth,heading:main.querySelector('h1,h2')?.textContent?.trim().slice(0,100),fields:main.querySelectorAll('input:not([type=hidden]),select,textarea').length};
      });
      assert.equal(shape.scheme,theme==='noa-ivory'?'light':'dark');assert(shape.overflow<=1,'horizontal overflow '+shape.overflow);
      results.push({width,href,actual:actual.pathname,status,access:'screen',...shape});
     }
    }catch(error){errors.push({width,href,message:String(error).slice(0,350)});console.log('MENU_REVIEW',width,href,errors.at(-1).message);}
    finally{await page.close();}
   }
  }finally{await c.close();}
 }));
}finally{
 await browser.close();
 writeFileSync(out+'/results.json',JSON.stringify({registry:registry.length,publicLinks:publicLinks.length,results,errors},null,2));
 console.log('MENU_SURFACES',JSON.stringify({registry:registry.length,publicLinks:publicLinks.length,screens:results.filter(r=>r.access==='screen').length,gates:results.filter(r=>r.access==='gate').length,errors}));
}
assert.equal(errors.length,0,'review menu-surface results');
