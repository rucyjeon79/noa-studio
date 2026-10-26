import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const live=process.env.NOA_ADMIN_LINK_PHASE==='live', browser=await chromium.launch({headless:true}), reports=[];
const script=live?await (await fetch('https://noastudio.ai.kr/noa-app/database/admin-link.js?verified='+Date.now())).text():await fs.readFile('deploy/noa-app/database/admin-link.js','utf8');
try{for(const width of [320,390,1280]){
 const page=await browser.newPage({viewport:{width,height:844}});
 await page.route('https://noastudio.ai.kr/adm/config_form.php',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width"><style>*{box-sizing:border-box}body{margin:0;font:16px sans-serif}#tnb{height:50px;background:#25282e}#tnb ul{margin:0;padding:0}#container{padding:24px}.btn_fixed_top{position:fixed;right:16px;top:0;z-index:100}button{min-height:44px;padding:10px 20px}main{margin-top:70px}</style><nav id="tnb"><ul></ul></nav><main id="container"><h1>환경설정</h1><form id="settings"><label>제목 <input value="NOA STUDIO"></label><div class="btn_fixed_top"><button type="submit">확인</button></div></form><p id="saved" role="status"></p></main><script>settings.onsubmit=e=>{e.preventDefault();saved.textContent="확인 동작 완료"}</script></html>'}));
 await page.goto('https://noastudio.ai.kr/adm/config_form.php');await page.addScriptTag({content:script});
 if(await page.locator('[data-noa-database-link]').count())throw Error('admin_database_link_overlaps');
 const target=page.getByRole('button',{name:'확인',exact:true});await target.click();await page.getByText('확인 동작 완료',{exact:true}).waitFor();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw Error('overflow');
 const folder='ainoa-proof/admin-link-'+(live?'live':'candidate');await fs.mkdir(folder,{recursive:true});await page.screenshot({path:folder+'/'+width+'.png'});reports.push({width,phase:live?'live':'candidate',databaseLinkRemoved:true,confirmClickable:true,noOverflow:true,fixture:'representative GnuBoard form; no production settings POST'});await page.close();
}await fs.mkdir('ainoa-proof',{recursive:true});await fs.writeFile('ainoa-proof/admin-link-'+(live?'live':'candidate')+'.json',JSON.stringify(reports,null,2));console.log('ADMIN_CONFIRM_UNOBSCURED',JSON.stringify(reports));}finally{await browser.close();}
