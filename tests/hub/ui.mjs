import {chromium} from 'playwright';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const repo=process.cwd(),base=fs.mkdtempSync(path.join(os.tmpdir(),'hub-ui-')),web=path.join(base,'html'),root=path.join(base,'noa-hub');
fs.mkdirSync(path.join(web,'noa-app','engine'),{recursive:true});fs.mkdirSync(root,{mode:0o700});
for(const name of ['hub.php','hub-release.php'])fs.copyFileSync(path.join(repo,'deploy/noa-app/engine',name),path.join(web,'noa-app/engine',name));
for(const name of ['noa-hub.php','noa-ui.css','noa-ui.js','noa-brand.js'])fs.copyFileSync(path.join(repo,'deploy',name),path.join(web,name));
fs.writeFileSync(path.join(web,'common.php'),"<?php session_start(); $is_member=($_COOKIE['fixture']??'')==='admin';$is_admin=$is_member?'super':'';");
fs.writeFileSync(path.join(root,'control.json'),JSON.stringify({revision:1,paused:false,activeOperations:['hub.verify']}));
fs.writeFileSync(path.join(root,'status.json'),JSON.stringify({heartbeatAt:Math.floor(Date.now()/1000)}));
fs.writeFileSync(path.join(root,'covers-result.json'),JSON.stringify({ok:true,recovered:2,remaining:1,checkedAt:Math.floor(Date.now()/1000)}));
const historyFile='history-'+ 'a'.repeat(40)+'.bundle',historyData='isolated source history';fs.writeFileSync(path.join(root,historyFile),historyData);
fs.writeFileSync(path.join(root,'source.json'),JSON.stringify({revision:1,files:10,history:[{commit:'a'.repeat(40),file:historyFile,sha256:crypto.createHash('sha256').update(historyData).digest('hex')}]}));
const server=spawn('php',['-S','127.0.0.1:8139','-t',web],{stdio:'ignore'});let browser;
try{
 for(let i=0;i<30;i++){try{await fetch('http://127.0.0.1:8139/noa-hub.php');break;}catch{await new Promise(r=>setTimeout(r,100));}}
 browser=await chromium.launch({channel:'chrome',headless:true,chromiumSandbox:true});const context=await browser.newContext();const page=await context.newPage();
 assert.equal((await page.goto('http://127.0.0.1:8139/noa-hub.php')).status(),403);
 await context.addCookies([{name:'fixture',value:'admin',domain:'127.0.0.1',path:'/'}]);
 await page.goto('http://127.0.0.1:8139/noa-hub.php');assert.equal(await page.getByRole('heading',{name:'N80 Hub',exact:true}).count(),1);
 assert.equal(await page.getByText('카드 이미지: 최근 보완 2개 · 대기 1개',{exact:true}).count(),1);
 await page.getByRole('button',{name:'일시정지',exact:true}).click();assert.equal(JSON.parse(fs.readFileSync(path.join(root,'control.json'))).paused,true);
 await page.getByRole('button',{name:'재개',exact:true}).click();assert.equal(JSON.parse(fs.readFileSync(path.join(root,'control.json'))).paused,false);
 const prior=fs.readFileSync(path.join(root,'control.json'),'utf8');await context.request.post('http://127.0.0.1:8139/noa-hub.php',{form:{action:'pause',csrf:'wrong',revision:'3'}});assert.equal(fs.readFileSync(path.join(root,'control.json'),'utf8'),prior);
 const csrf=await page.locator('input[name=csrf]').first().getAttribute('value');const download=await context.request.post('http://127.0.0.1:8139/noa-hub.php',{form:{action:'increment_download',csrf,index:'0'}});assert.equal(await download.text(),historyData);assert.match(download.headers()['content-disposition'],/attachment/);
 const rejected=await context.request.post('http://127.0.0.1:8139/noa-hub.php',{form:{action:'increment_download',csrf,index:'../access.key'}});assert.equal(rejected.headers()['content-disposition'],undefined);
 fs.mkdirSync('hub-proof',{recursive:true});
 for(const width of [390,1440]){await page.setViewportSize({width,height:900});await page.reload();assert.ok(await page.getByRole('button',{name:'검증 후 배포'}).isVisible());assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`hub-proof/admin-${width}.png`,fullPage:true});}
 console.log('N80_HUB_UI_PASSED administrator, guest denial, CSRF, controls, mobile and desktop');
}finally{await browser?.close();server.kill('SIGTERM');fs.rmSync(base,{recursive:true,force:true});}
