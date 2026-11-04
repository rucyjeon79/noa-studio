import {chromium} from 'playwright';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const themes=JSON.parse(readFileSync('deploy/noa-design.json')).themes;
const css=name=>readFileSync('deploy/'+name+'.css','utf8');
const styles=['noa-ui','noa-gifts','noa-support','noa-record-form','noa-creator-apply','noa-ai-lab','noa-gnuboard','noa-member-badges','noa-starlight'];
const fragment=`<main>
<section id="profile" class="new_win"><section><p>회원 자기소개</p></section><table><tr><th>가입일</th><td>11월 4일</td></tr></table></section>
<div id="noa-my-account"><button class="noa-my-creator-apply">크리에이터 신청</button><span class="noa-gift-count">3</span></div>
<button class="noa-support-button">후원</button>
<div class="noa-support-dialog"><h3>크리에이터 후원</h3><button class="noa-support-primary">후원하기</button></div>
<form class="ncea-form"><div class="ncea-fields"><label>이름<input type="text"></label><label>채널<select><option>NOA</option></select></label></div><button type="submit">신청 저장</button></form>
<div class="noa-record-editor"><form class="noa-record-form"><fieldset class="noa-record-section"><legend>음원 수정</legend><div class="noa-record-field"><label for="song-title">곡 제목</label><input id="song-title" value="테마 검수"><textarea aria-invalid="true">가사</textarea><input type="file"><input readonly value="기존 음원"></div></fieldset><button type="submit" disabled>저장</button></form></div>
<section id="bo_w"><form><div class="btn_confirm"><button class="btn_cancel" type="button">취소</button><button class="btn_submit" type="submit">등록</button></div><iframe title="본문 편집" srcdoc="&lt;body contenteditable='true'&gt;원본 &lt;b&gt;본문&lt;/b&gt;&lt;/body&gt;"></iframe></form></section>
</main>`;
const report=[],out='room-theme-proof/surface-controls';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
try{
 for(const width of [320,390,768,1440]){
  const p=await browser.newPage({viewport:{width,height:900}});
  await p.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><body class="noa-page">'+fragment+'</body>');
  for(const name of styles)await p.addStyleTag({content:css(name)});
  const writer=readFileSync('deploy/noa-ui.js','utf8').split('/* Match the writing canvas')[1];
  await p.addScriptTag({content:writer.slice(writer.indexOf('*/')+2)});
  const editable=p.frameLocator('#bo_w iframe').locator('body');const stored=await editable.innerHTML();
  await editable.evaluate(body=>{const old=body.ownerDocument.createElement('style');old.textContent='html body[contenteditable]{background-color:white;color:black}';body.ownerDocument.head.append(old);});
  for(const theme of themes){
   await p.evaluate(theme=>{const r=document.documentElement;r.className='noa-shell-wide noa-g5';r.dataset.noaStyle='starlight';r.dataset.noaTheme=theme.id;r.dataset.noaPrecision='true';r.style.colorScheme=theme.id==='noa-ivory'?'light':'dark';for(const [k,v] of Object.entries(theme.tokens))r.style.setProperty('--noa-'+k,v,'important');window.dispatchEvent(new Event('noa-theme'));},theme);
   const rows=await p.evaluate(()=>{
    const rgb=name=>{const i=document.createElement('i');i.style.color='var(--noa-'+name+')';document.body.append(i);const color=getComputedStyle(i).color;i.remove();return color;};
    const probes=[
     ['#profile table td','text','surface'],['.noa-my-creator-apply','accentText','accent'],['.noa-gift-count','accentText','accent'],
     ['.noa-support-button','accent'],['.noa-support-primary','accentText','accent'],['#bo_w .btn_submit','accentText','accent'],
     ['.ncea-form input','text','bg'],['.ncea-form select','text','bg'],['.noa-record-field input[readonly]','muted','surface'],
     ['.noa-record-field textarea','text','bg'],['.noa-record-form button[disabled]','muted','raised']
    ];
    return probes.map(([s,ink,fill])=>{const node=document.querySelector(s),c=getComputedStyle(node);return {s,ink:c.color===rgb(ink),fill:!fill||c.backgroundColor===rgb(fill),width:node.getBoundingClientRect().width};});
   });
   for(const row of rows)assert(row.ink&&row.fill&&row.width>0,JSON.stringify({width,theme:theme.id,row}));
   assert.equal(await editable.innerHTML(),stored);assert.equal(await editable.evaluate(el=>getComputedStyle(el).backgroundColor),await p.evaluate(()=>getComputedStyle(document.body).backgroundColor));
   const field=p.locator('#song-title');assert.equal(await field.evaluate(n=>getComputedStyle(n).borderRadius),'4px');assert((await field.boundingBox()).height>=44);
   await field.fill('수정한 제목');await field.focus();assert.notEqual(await field.evaluate(n=>getComputedStyle(n).outlineStyle),'none');
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow '+width);
   report.push({width,theme:theme.id,controls:rows.length,editorMarkupPreserved:true});
  }
  await p.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><main id="container"><form class="tbl_frm01"><table><tr><th>회원 이름</th><td><input aria-label="이름" class="frm_input" value="기존 이름"></td></tr></table><div class="btn_fixed_top"><button type="submit" class="btn_submit">수정 저장</button></div></form></main>');
  await p.addStyleTag({content:css('noa-admin')});
  for(const theme of themes){
   await p.evaluate(theme=>{const root=document.documentElement;root.dataset.noaTheme=theme.id;for(const [k,v] of Object.entries(theme.tokens))root.style.setProperty('--noa-'+k,v);},theme);
   await p.locator('.frm_input').fill('검수 이름');
   const pass=await p.evaluate(()=>{
    const btn=document.querySelector('.btn_submit'),input=document.querySelector('.frm_input');
    const expected=key=>{const n=document.createElement('i');n.style.color='var(--noa-'+key+')';document.body.append(n);const result=getComputedStyle(n).color;n.remove();return result;};
    return input.value==='검수 이름'&&input.getBoundingClientRect().height>=44&&getComputedStyle(input).borderRadius==='4px'&&getComputedStyle(btn).color===expected('accentText')&&getComputedStyle(btn).backgroundColor===expected('accent');
   });assert(pass,'native admin form '+theme.id+' '+width);report.push({width,theme:theme.id,nativeAdminForm:true});
  }
  await p.close();
 }
}finally{await browser.close();writeFileSync(out+'/results.json',JSON.stringify(report,null,2));}
console.log('SURFACE_CONTROLS_OK',report.length);
