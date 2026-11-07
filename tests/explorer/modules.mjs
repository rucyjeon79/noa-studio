import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base='https://modules.test';
const songs=[{key:'single:one',title:'같은 제목',ep:40,genre:'groovy-airy-pop'},{key:'single:two',title:'같은 제목',ep:40,genre:'kpop-original'}];
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
function source(path){return readFileSync('deploy'+path,'utf8');}
function html(page){return '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body>'+page+'</body></html>';}
async function fixture(path,body,api){
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route(base+'/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname===path&&route.request().method()==='GET')return route.fulfill({contentType:'text/html; charset=utf-8',body});
  const response=await api(url,route.request());if(response)return route.fulfill({json:response});
  if(url.pathname.endsWith('.js')||url.pathname.endsWith('.css'))return route.fulfill({contentType:url.pathname.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8',body:source(url.pathname)});
  return route.fulfill({json:{ok:true,items:[]}});
 });
 await page.goto(base+path);return {page,errors};
}
try{
 for(const space of ['lounge','shop']){
  const product={...JSON.parse(readFileSync('deploy/noa-products.json'))[0],musicKeys:['legacy:key']};let saved;
  const {page,errors}=await fixture('/noa-'+space+'.php',html('<main id="ecosystem" data-space="'+space+'"><div id="ec-hero-actions"></div><div id="ec-status"></div><nav id="ec-tools"></nav><section id="ec-content"></section></main><script src="/noa-ecosystem.js"></script>'),async(url,request)=>{
   if(url.pathname!=='/noa-bridge/ecosystem.php')return null;
   const action=url.searchParams.get('action');
   if(action==='session')return {ok:true,member:true,admin:true,level:10,creator:true,csrf:'fixture',capabilities:['shop','community']};
   if(action==='shop')return {ok:true,products:[product],managedProducts:[product],state:{wishlist:[],cart:[]},popularity:{},storeUrl:'https://marpple.shop/kr/jr_lifestyle'};
   if(action==='catalog')return {ok:true,items:songs};
   if(action==='save'||action==='product-save'){saved=request.postDataJSON();return {ok:true};}
   return {ok:true,items:[],total:0,page:1,pages:1};
  });
  if(space==='lounge'){
   await page.goto(base+'/noa-lounge.php?compose=music');
   await page.getByText('음악·영상·이미지 연결',{exact:true}).click();
   await page.getByRole('button',{name:'N80 탐색기 · 음악 연결',exact:true}).click();
   await page.locator('[data-n80-key="single:two"]').click();
   assert.equal(saved,undefined);
   await page.getByLabel('제목',{exact:true}).fill('연결 확인');await page.getByLabel('내용',{exact:true}).fill('선택된 곡');
   await page.getByRole('button',{name:'게시하기',exact:true}).click();await page.waitForTimeout(100);
   assert.equal(saved.musicKey,'single:two');
  }else{
   await page.getByRole('button',{name:'상품 관리',exact:true}).click();await page.getByLabel('상품',{exact:true}).selectOption(product.id);
   await page.getByRole('button',{name:'N80 탐색기 · 상품 음악 연결',exact:true}).click();await page.locator('[data-n80-key="single:two"]').click();
   await page.getByRole('button',{name:'2개 선택 적용',exact:true}).click();assert.equal(saved,undefined);
   await page.getByRole('button',{name:'상품 정보 저장',exact:true}).click();await page.waitForTimeout(100);
   assert.deepEqual(saved.musicKeys,['legacy:key','single:two']);
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 const canonical='a'.repeat(64);let review;
 const youtube=source('/noa-youtube-admin.php').replace(/<\?[\s\S]*?\?>/g,'').replace(/<script[^>]*>[\s\S]*?<\/script>/g,'');
 const yt=await fixture('/noa-youtube-admin.php',youtube+'<script src="/noa-youtube.js"></script>',async(url,request)=>{
  if(url.pathname!=='/noa-bridge/youtube-api.php')return null;
  if(request.method()==='POST'){review=request.postDataJSON();return {ok:true};}
  return {csrf:'fixture',configured:true,channels:[],run:null,songs:[{id:canonical,title:'같은 제목',genre:'kpop-original',ep:40}],noaPlaylists:[],decisions:{},playlists:{},videos:[{id:'abcdefghijk',snippet:{title:'연결할 영상'},status:{privacyStatus:'public'},match:{songId:null,candidates:[]}}]};
 });
 await yt.page.locator('#yt-reviews summary').click();await yt.page.getByRole('button',{name:'N80 탐색기',exact:true}).click();
 await yt.page.locator('[data-n80-key="'+canonical+'"]').click();await yt.page.getByRole('textbox',{name:'검토 사유',exact:true}).fill('장르와 EP 확인');
 assert.equal(review,undefined);await yt.page.getByRole('button',{name:'검토 결과 저장',exact:true}).click();await yt.page.waitForTimeout(100);
 assert.equal(review.entityId,canonical);assert.equal(review.objectId,'abcdefghijk');assert.deepEqual(yt.errors,[]);await yt.page.close();
 console.log('N80_POST_SHOP_YOUTUBE_ADAPTERS_OK');
}finally{await browser.close();}
