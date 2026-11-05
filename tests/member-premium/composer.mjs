import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const design=JSON.parse(readFileSync('deploy/noa-design.json','utf8'));
export async function verifyComposer(browser,out,report){
 for(const width of [320,390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:800},serviceWorkers:'block'});context.setDefaultTimeout(15000);
  const source={id:'a'.repeat(32),space:'lounge',category:'chat',visibility:'public',mine:true,name:'검증 회원',title:'기존 제목',body:'기존 본문',images:[],options:[],at:1,revision:7};let saves=[];
  await context.route('**/*',async r=>{
   const u=new URL(r.request().url());if(u.origin!=='https://composer.fixture')return r.abort();
   if(u.pathname==='/noa-lounge.php')return r.fulfill({contentType:'text/html',body:'<!doctype html><html data-noa-style="starlight"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-ecosystem.css"><link rel="stylesheet" href="/noa-starlight.css"><link rel="stylesheet" href="/noa-member-surfaces.css"><main id="ecosystem" data-space="lounge"><div id="ec-hero-actions"></div><div id="ec-tools"></div><div id="ec-content"></div><p id="ec-status"></p></main><script src="/noa-member-surfaces.js"></script><script src="/noa-ecosystem.js"></script></html>'});
   if(u.pathname==='/noa-bridge/ecosystem.php'){
    const a=u.searchParams.get('action');if(a==='save')saves.push(r.request().postDataJSON());
    const d=a==='detail'?{post:source,comments:[],versions:[],applications:[]}:a==='session'?{member:true,level:8,admin:false,creator:true}:a==='list'?{items:[],total:0}:a==='save'?{id:source.id}:{items:[]};return r.fulfill({json:{ok:true,...d}});
   }
   if(/\.(css|js)$/.test(u.pathname))return r.fulfill({body:readFileSync('deploy'+u.pathname),contentType:u.pathname.endsWith('.css')?'text/css':'text/javascript'});
   return r.fulfill({status:404,body:''});
  });
  const page=await context.newPage();let pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
  for(const theme of design.themes)for(const edit of [false,true]){try{
   await page.goto('https://composer.fixture/noa-lounge.php?'+(edit?'post='+source.id:'compose=chat'));
   await page.evaluate(theme=>{document.documentElement.dataset.noaTheme=theme.id;for(const [key,val] of Object.entries(theme.tokens))document.documentElement.style.setProperty('--noa-'+key,val)},theme);
   if(edit)await page.getByRole('button',{name:'글 수정',exact:true}).click();
   const dialog=page.locator('dialog[open]');await dialog.waitFor();
   assert.equal(await dialog.getByLabel('내용',{exact:true}).inputValue(),edit?source.body:'');
   await dialog.getByLabel('제목',{exact:true}).fill('회원 작성 화면 검수');await dialog.getByLabel('내용',{exact:true}).fill('입력한 글과 수정 이력을 유지합니다.');
   await dialog.locator('summary').filter({hasText:'음악·영상·이미지 연결'}).click();
   const g=await dialog.evaluate(el=>({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,overflow:el.scrollWidth-el.clientWidth}));assert(g.left>=0&&g.right<=width+1&&g.overflow<=1,JSON.stringify({width,g}));
   if([390,1440].includes(width)&&!edit)await page.screenshot({path:out+'/composer-'+width+'-'+theme.id+'.jpg',type:'jpeg',quality:86});
   await dialog.getByRole('button',{name:edit?'수정 저장':'게시하기',exact:true}).click();await dialog.waitFor({state:'detached'});
   assert.equal(saves.at(-1).title,'회원 작성 화면 검수');assert.equal(saves.at(-1).revision,edit?7:0);
   report.fixtures.push({key:'actual-community-composer',width,theme:theme.id,edit,isolatedSave:true,productionWrites:0});
  }catch(error){await page.screenshot({path:out+'/composer-failure-'+width+'.png',fullPage:true});console.log('COMPOSER_DIAGNOSTIC',JSON.stringify({width,edit,pageErrors,body:await page.locator('body').innerText(),dialogs:await page.locator('dialog').evaluateAll(ds=>ds.map(d=>d.outerHTML))}));throw error;}}
  await context.close();
 }
 console.log('MEMBER_ACTUAL_COMPOSER_CREATE_EDIT_OK');
}
