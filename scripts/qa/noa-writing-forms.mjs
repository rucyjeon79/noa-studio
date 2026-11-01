import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
const browser = await chromium.launch({channel:'chrome',args:['--no-sandbox']});
const base='https://fixture.test';
const original={id:'a'.repeat(32),space:'lounge',category:'chat',visibility:'public',mine:true,name:'검수',title:'편집 전 제목',body:'편집 전 본문',images:[],options:[],at:1,revision:7};
const detail={ok:true,post:original,comments:[],versions:[],applications:[]};
const shell='<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-ecosystem.css"><main id="ecosystem" data-space="lounge"><div id="ec-hero-actions"></div><div id="ec-tools"></div><div id="ec-content"></div><p id="ec-status"></p></main><script src="/noa-ecosystem.js"></script>';
try {
  for(const width of [320,390,760,1280]){
    const page=await browser.newPage({viewport:{width,height:width<=390?560:800}});
    let saves=[];
    await page.route('**/*',async r=>{
      const u=new URL(r.request().url());
      if(u.origin!==base)return r.abort();
      if(u.pathname==='/noa-lounge.php')return r.fulfill({contentType:'text/html;charset=utf-8',body:shell});
      if(u.pathname==='/noa-bridge/ecosystem.php'){
        const a=u.searchParams.get('action');
        if(a==='save')saves.push(r.request().postDataJSON());
        const d=a==='detail'?detail:a==='session'?{member:true,level:10,admin:true,creator:true}:a==='list'?{items:[],total:0}:a==='save'?{id:original.id}:{items:[]};
        return r.fulfill({json:{ok:true,...d}});
      }
      if(['/noa-ui.css','/noa-ecosystem.css','/noa-ecosystem.js'].includes(u.pathname))return r.fulfill({path:process.cwd()+'/deploy'+u.pathname,contentType:u.pathname.endsWith('css')?'text/css':'application/javascript'});
      return r.fulfill({status:404,body:''});
    });
    for(const editing of [false,true]){
      await page.goto(base+'/noa-lounge.php?'+(editing?'post='+original.id:'compose=chat'));
      if(editing)await page.getByRole('button',{name:'글 수정',exact:true}).click();
      const dialog=page.locator('dialog[open]');
      const body=dialog.getByLabel('내용',{exact:true});
      assert.equal(await body.inputValue(),editing?original.body:'');
      await dialog.getByLabel('제목',{exact:true}).fill('검수 제목');
      await body.fill('검수 본문');
      await dialog.locator('summary').filter({hasText:'음악·영상·이미지 연결'}).click();
      const geometry=await dialog.evaluate(el=>({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,overflow:el.scrollWidth-el.clientWidth}));
      assert(geometry.left>=0&&geometry.right<=width+1&&geometry.overflow<=1,JSON.stringify({width,geometry}));
      await dialog.getByRole('button',{name:editing?'수정 저장':'게시하기',exact:true}).click();
      await dialog.waitFor({state:'detached'});
      assert.equal(saves.at(-1).title,'검수 제목');
      assert.equal(saves.at(-1).revision,editing?7:0);
    }
    await page.close();
    console.log(width,'create and edit OK');
  }
}finally{await browser.close();}
