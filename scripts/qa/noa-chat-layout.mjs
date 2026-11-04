import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const base='https://noastudio.ai.kr';
const browser=await chromium.launch({channel:'chrome'});
try {
 for (const width of [320,390,1280]) {
  const page=await browser.newPage({viewport:{width,height:780},serviceWorkers:'block'});
  await page.route('**/noa-ainoa.php?action=admin_workspace',route=>route.fulfill({json:{ok:true,tasks:[],generation:{ready:false,missing:['api_key']}}}));
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  await page.addStyleTag({content:readFileSync('deploy/noa-ainoa.css','utf8')});
  await page.addScriptTag({content:readFileSync('deploy/noa-ainoa-admin.js','utf8')});
  await page.evaluate(()=>window.NoaAInoaAdmin.open({current:()=>null}));
  const panel=page.locator('#ainoa-admin-dialog');
  assert(await panel.isVisible());
  assert(!await panel.locator('.ainoa-admin-context').isVisible());
  assert(await panel.getByRole('button',{name:'보내기'}).isVisible());
  assert(await panel.evaluate(n=>n.scrollWidth<=n.clientWidth+1));
  await panel.getByRole('button',{name:'닫기'}).click();
  await page.evaluate(()=>window.NoaAInoaAdmin.open({current:()=>({key:'fixture',title:'First Glance'})}));
  const checkbox=panel.getByRole('checkbox');const box=await checkbox.boundingBox();
  assert(box && box.width<=20 && box.height<=20);await checkbox.uncheck();
  await panel.locator('.ainoa-admin-input').fill('곡 소개');
  await panel.getByText('AI 연결 설정',{exact:true}).first().click();
  assert(await panel.locator('.ainoa-admin-connection').isVisible());
  console.log('Chat layout and controls verified at',width);await page.close();
 }
} finally {await browser.close();}
