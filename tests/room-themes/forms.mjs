import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
const browser = await chromium.launch({channel:'chrome',args:['--no-sandbox']});
const base='https://fixture.test';
const themes=JSON.parse(fs.readFileSync('deploy/noa-design.json','utf8')).themes;
const out='room-theme-proof/forms';fs.mkdirSync(out,{recursive:true});
async function paint(page,theme){
 await page.evaluate(theme=>{const r=document.documentElement;r.classList.add('noa-shell-wide');r.dataset.noaTheme=theme.id;r.dataset.noaStyle='starlight';r.dataset.noaPrecision='true';r.style.colorScheme=theme.id==='noa-ivory'?'light':'dark';for(const [key,value]of Object.entries(theme.tokens))r.style.setProperty('--noa-'+key,value);},theme);
 await page.addStyleTag({content:fs.readFileSync('deploy/noa-starlight.css','utf8')});
}

const original={id:'a'.repeat(32),space:'lounge',category:'chat',visibility:'public',mine:true,name:'검수',title:'편집 전 제목',body:'편집 전 본문',images:[],options:[],at:1,revision:7};
const detail={ok:true,post:original,comments:[],versions:[],applications:[]};
const shell='<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-ecosystem.css"><main id="ecosystem" data-space="lounge"><div id="ec-hero-actions"></div><div id="ec-tools"></div><div id="ec-content"></div><p id="ec-status"></p></main><script src="/noa-ecosystem.js"></script>';
try {
  for(const theme of themes)for(const width of [320,390,760,1280]){
    const page=await browser.newPage({viewport:{width,height:width<=390?560:800}});
    const saves=[],posts=new Map([[original.id,{...original}]]);
    await page.route('**/*',async r=>{
      const u=new URL(r.request().url());
      if(u.origin!==base)return r.abort();
      if(u.pathname==='/noa-lounge.php')return r.fulfill({contentType:'text/html;charset=utf-8',body:shell});
      if(u.pathname==='/noa-bridge/ecosystem.php'){
        const a=u.searchParams.get('action');
        if(a==='save'){
          const payload=r.request().postDataJSON();saves.push(payload);
          posts.set(payload.id,{...original,...payload,revision:payload.revision+1});
        }
        const d=a==='detail'?{...detail,post:posts.get(u.searchParams.get('id'))||original}:a==='session'?{member:true,level:10,admin:true,creator:true}:a==='list'?{items:[],total:0}:a==='save'?{id:original.id}:{items:[]};
        return r.fulfill({json:{ok:true,...d}});
      }
      if(['/noa-ui.css','/noa-ecosystem.css','/noa-ecosystem.js'].includes(u.pathname))return r.fulfill({path:process.cwd()+'/deploy'+u.pathname,contentType:u.pathname.endsWith('css')?'text/css':'application/javascript'});
      return r.fulfill({status:404,body:''});
    });
    for(const editing of [false,true]){
      await page.goto(base+'/noa-lounge.php?'+(editing?'post='+original.id:'compose=chat'));
      await paint(page,theme);
      if(editing)await page.getByRole('button',{name:'글 수정',exact:true}).click();
      const dialog=page.locator('dialog[open]');
      const body=dialog.getByLabel('내용',{exact:true});
      assert.equal(await body.inputValue(),editing?original.body:'');
      await dialog.getByLabel('제목',{exact:true}).fill('검수 제목');
      await body.fill('검수 본문');
      await dialog.locator('summary').filter({hasText:'음악·영상·이미지 연결'}).click();
      const geometry=await dialog.evaluate(el=>({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,overflow:el.scrollWidth-el.clientWidth}));
      assert(geometry.left>=0&&geometry.right<=width+1&&geometry.overflow<=1,JSON.stringify({width,geometry}));
      const labelColors=await dialog.locator('form.ec-form label').evaluateAll(labels=>[...new Set(labels.map(l=>getComputedStyle(l).color))]);
      const hex=theme.tokens.text.slice(1),expected='rgb('+[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)).join(', ')+')';
      assert.deepEqual(labelColors,[expected],'every composer field label follows the readable theme text');
      assert.equal(await dialog.evaluate(el=>getComputedStyle(el).colorScheme),theme.id==='noa-ivory'?'light':'dark','native date controls follow the selected theme');
      assert(await dialog.evaluate(d=>{
        const header=d.querySelector('header'),line=document.createElement('i');
        line.style.color='var(--noa-line)';d.append(line);
        const same=getComputedStyle(header).borderBottomColor===getComputedStyle(line).color;line.remove();return same;
      }),'editor heading divider uses the active theme');
      await dialog.evaluate(el=>el.scrollTop=0);
      await dialog.screenshot({path:out+'/'+theme.id+'-'+width+'-'+(editing?'edit':'compose')+'.png'});
      await dialog.getByRole('button',{name:editing?'수정 저장':'게시하기',exact:true}).click();
      await dialog.waitFor({state:'detached'});
      assert.equal(saves.at(-1).title,'검수 제목');
      assert.equal(saves.at(-1).revision,editing?7:0);
      assert.equal(saves.at(-1).body,'검수 본문');
      await page.goto(base+'/noa-lounge.php?post='+saves.at(-1).id);
      await page.getByRole('button',{name:'글 수정',exact:true}).click();
      assert.equal(await page.locator('dialog[open]').getByLabel('내용',{exact:true}).inputValue(),'검수 본문');
      assert.equal(await page.locator('dialog[open]').getByLabel('제목',{exact:true}).inputValue(),'검수 제목');
    }
    // Exercise native board field groups using both an empty and a populated draft.
    for(const editing of [false,true]){
      await page.setContent('<html class="noa-g5"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="wrapper"><div id="container"><section id="bo_w"><form id="fwrite"><input type="hidden" name="w"><input type="hidden" name="token" value="fixture-only"><div class="bo_w_info"><input class="frm_input" placeholder="이름"><input class="frm_input" placeholder="비밀번호"></div><div id="autosave_wrapper"><input id="wr_subject" name="wr_subject" class="frm_input"><button type="button" id="btn_autosave">임시저장 글</button></div><textarea id="wr_content" name="wr_content"></textarea><div class="file_wr"><label class="lb_icon">첨부</label><input name="bf_file[]" type="file"></div><div class="btn_confirm"><button type="button" class="btn_cancel">취소</button><button type="submit" class="btn_submit">저장</button></div></form></section></div></div></body></html>');
      for(const name of ['noa-ui','noa-gnuboard'])await page.addStyleTag({content:fs.readFileSync('deploy/'+name+'.css','utf8')});
      await paint(page,theme);
      await page.locator('#fwrite').evaluate((form,editing)=>{
        form.elements.w.value=editing?'u':'';
        form.onsubmit=e=>{e.preventDefault();const data=new FormData(form);window.submitted=[data.get('w'),data.get('wr_subject'),data.get('wr_content'),data.get('token'),data.get('bf_file[]').name];};
      },editing);
      await page.locator('#wr_subject').fill(editing?'기존 제목 수정':'새 글 제목');
      await page.locator('#wr_content').fill('본문 검수');
      await page.locator('input[type=file]').setInputFiles({name:'긴첨부파일이름'.repeat(12)+'.txt',mimeType:'text/plain',buffer:Buffer.from('preview')});
      const bounds=await page.locator('#bo_w').evaluate(el=>({scroll:el.scrollWidth-el.clientWidth,outside:[...el.querySelectorAll('button,input,textarea')].some(x=>x.getBoundingClientRect().right>document.documentElement.clientWidth+1)}));
      assert(bounds.scroll<=1&&!bounds.outside,JSON.stringify({width,bounds}));
      await page.locator('#fwrite .btn_submit').click();
      assert.deepEqual(await page.evaluate(()=>window.submitted),[editing?'u':'',editing?'기존 제목 수정':'새 글 제목','본문 검수','fixture-only','긴첨부파일이름'.repeat(12)+'.txt']);
    }
    await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><main id="ecosystem" data-space="shop"><article class="ec-cart-row"><img alt=""><div><h3>한정판 별무리 머그잔</h3></div><div class="ec-actions"><input type="number" value="10"><button>수량 저장</button><button>빼기</button></div><input aria-label="옵션 메모"><button>메모 저장</button></article></main>');
    for(const name of ['noa-ui','noa-ecosystem'])await page.addStyleTag({content:fs.readFileSync('deploy/'+name+'.css','utf8')});
    await paint(page,theme);
    const note=await page.getByLabel('옵션 메모').boundingBox();
    const save=await page.getByRole('button',{name:'메모 저장'}).boundingBox();
    assert(Math.abs(note.y-save.y)<2 && note.x+note.width<=save.x && save.x+save.width<=width+1,JSON.stringify({width,note,save}));
    await page.setContent('<main id="noa-my-account"><section id="special-invite-share"><strong>람준파파의 특별한 별무리 초대장</strong><p>한 분에게만 전달해 주세요.</p><a class="noa-button" href="#">메시지로 보내기</a><button>링크 복사</button><input readonly></section><dl class="noa-my-account-grid"><dt>현재 구독상태</dt></dl></main>');
    for(const name of ['noa-ui','noa-account','noa-gifts'])await page.addStyleTag({content:fs.readFileSync('deploy/'+name+'.css','utf8')});
    await paint(page,theme);
    const share=page.locator('#special-invite-share');
    const first=await share.locator('a').boundingBox(), second=await share.locator('button').boundingBox();
    const panel=await share.boundingBox(), wallet=await page.locator('.noa-my-account-grid').boundingBox();
    assert(Math.max(second.x-first.x-first.width,second.y-first.y-first.height)>=7.9,'invitation controls touch');
    assert(wallet.y-panel.y-panel.height>=19.9,'wallet touches invitation');
    await page.close();
    console.log(theme.id,width,'isolated create/edit, board inputs, cart controls and member invitation OK');
  }
}finally{await browser.close();}
