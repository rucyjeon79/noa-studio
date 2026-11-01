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
    // Exercise native board field groups using both an empty and a populated draft.
    for(const editing of [false,true]){
      await page.setContent('<html class="noa-g5"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="wrapper"><div id="container"><section id="bo_w"><form id="fwrite"><div class="bo_w_info"><input class="frm_input" placeholder="이름"><input class="frm_input" placeholder="비밀번호"></div><div id="autosave_wrapper"><input id="wr_subject" class="frm_input"><button type="button" id="btn_autosave">임시저장 글</button></div><textarea id="wr_content"></textarea><div class="file_wr"><label class="lb_icon">첨부</label><input type="file"></div><div class="btn_confirm"><button type="button" class="btn_cancel">취소</button><button type="submit" class="btn_submit">저장</button></div></form></section></div></div></body></html>');
      for(const name of ['noa-ui','noa-gnuboard'])await page.addStyleTag({content:fs.readFileSync('deploy/'+name+'.css','utf8')});
      await page.locator('#wr_subject').fill(editing?'기존 제목 수정':'새 글 제목');
      await page.locator('#wr_content').fill('본문 검수');
      await page.locator('input[type=file]').setInputFiles({name:'긴첨부파일이름'.repeat(12)+'.txt',mimeType:'text/plain',buffer:Buffer.from('preview')});
      const bounds=await page.locator('#bo_w').evaluate(el=>({scroll:el.scrollWidth-el.clientWidth,outside:[...el.querySelectorAll('button,input,textarea')].some(x=>x.getBoundingClientRect().right>document.documentElement.clientWidth+1)}));
      assert(bounds.scroll<=1&&!bounds.outside,JSON.stringify({width,bounds}));
    }
    await page.close();
    console.log(width,'create and edit OK');
  }
}finally{await browser.close();}
