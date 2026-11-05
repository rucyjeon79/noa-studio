/* Member-facing presentation only: keep native controls, values, actions and handlers. */
(()=>{'use strict';
if(/^\/adm\//.test(location.pathname)||window.NoaMemberSurfaces)return;
const root=document.documentElement;root.classList.add('noa-member-ui');
const tableScope='#sod_bsk table,#sod_frm table,#sod_fin table,#sod_v table,#sod_inquiry table';
const listTableScope='#bo_list table,.new_win .tbl_head01 table,.new_win .tbl_head02 table';
function columnKind(cell,label){
 if(cell.matches('.td_chk')||cell.querySelector('input[type=checkbox]'))return 'check';
 if(cell.matches('.td_subject,.td_prd')||/제목|상품명|내용|내역/.test(label))return 'title';
 if(/금액|판매가|소계|합계|포인트|적립|사용/.test(label))return 'amount';
 if(/일시|날짜|작성일|등록일|만료|기간/.test(label))return 'date';
 if(/글쓴이|작성자|보낸|받는/.test(label))return 'author';
 if(/번호|조회|추천|수량/.test(label))return 'number';
 return 'text';
}
function tableLabels(table,kind='order'){
 if(table.closest('#bo_v_con,[data-user-content],[contenteditable]'))return;
 if(table.closest('#sod_frm_orderer,#sod_frm_taker')||(!table.tHead&&table.querySelector('th')&&table.querySelector('input,select,textarea'))){table.classList.add('noa-native-form-table');return;}
 if(!table.tHead)return;
 const heads=[...table.tHead.rows].at(-1);if(!heads)return;
 const labels=[];for(const cell of heads.cells)for(let i=0;i<cell.colSpan;i++)labels.push(cell.textContent.trim());
 // Multi-row/rowspan order tables keep their native scrollable layout.
 if(table.tHead.rows.length!==1||[...heads.cells].some(cell=>cell.colSpan>1)||[...table.rows].some(row=>[...row.cells].some(cell=>cell.rowSpan>1)))return;
 table.classList.add(kind==='order'?'noa-native-order-table':kind==='policy'?'noa-policy-table':'noa-member-list-table');
 if(table.closest('#bo_list'))table.classList.add('noa-board-table');
 const kinds=[...heads.cells].map((cell,index)=>columnKind(cell,labels[index]));
 for(const body of table.tBodies)for(const row of body.rows)for(let i=0;i<row.cells.length;i++){
  const cell=row.cells[i];if(cell.colSpan===1&&(cell.matches('.td_chk,.td_subject,.td_prd')||cell.querySelector('input[type=checkbox]')))kinds[i]=columnKind(cell,labels[i]||'');
 }
 [...heads.cells].forEach((cell,index)=>{cell.dataset.noaKind=kinds[index];});
 for(const body of table.tBodies)for(const row of body.rows){let index=0;for(const cell of row.cells){
  if(cell.colSpan===1){if(labels[index])cell.dataset.noaColumn=labels[index];cell.dataset.noaKind=kinds[index]||'text';}index+=cell.colSpan;
 }}
}
function visibleLabel(field){return [...(field.labels||[])].some(label=>{const r=label.getBoundingClientRect();return r.width>4&&r.height>4;});}
function fieldLabel(id,text){
 const field=document.getElementById(id);if(!field||!field.closest('#bo_w')||visibleLabel(field)||document.querySelector('[data-noa-label-for="'+id+'"]'))return;
 const label=document.createElement('label');label.htmlFor=id;label.dataset.noaLabelFor=id;label.className='noa-member-field-label';label.textContent=text;
 if(field.required){const required=document.createElement('span');required.className='noa-member-required';required.textContent='필수';label.append(required);}
 const row=field.closest('#autosave_wrapper,.bo_w_tit,.bo_w_link,.write_div')||field;
 row.before(label);
}
function memberPresentation(){
 // Reuse the native introduction and label. No fields or form handlers move.
 const recovery=document.querySelector('#find_info form');
 if(recovery&&!recovery.querySelector('.noa-account-intro')){
  const heading=recovery.querySelector(':scope>h3'),description=recovery.querySelector('#info_fs>p');
  if(heading&&description){
   const intro=document.createElement('div');intro.className='noa-account-intro';
   const kicker=document.createElement('span');kicker.className='noa-member-kicker';kicker.textContent='MY STUDIO';
   recovery.prepend(intro);intro.append(kicker,heading,description);
  }
 }
 const empty=document.querySelector('#sod_bsk.noa-cart-empty :is(.empty_table,.empty_list)');
 if(empty&&!empty.querySelector('.noa-cart-empty-title')){
  const title=document.createElement('strong');title.className='noa-cart-empty-title';title.textContent='취향을 담을 자리';
  const note=document.createElement('span');note.className='noa-cart-empty-note';
  while(empty.firstChild)note.append(empty.firstChild);empty.append(title,note);
 }
 // Counts are interface copy, not catalog data or prices.
 document.querySelectorAll('.ny-section-title>span').forEach(el=>{
  const match=el.textContent.trim().match(/^(\d+) PRODUCTS$/);if(match)el.textContent=match[1]+'개 상품';
 });
}
function enhance(){
 document.querySelectorAll(tableScope).forEach(table=>tableLabels(table));
 document.querySelectorAll(listTableScope).forEach(table=>tableLabels(table,'list'));
 document.querySelectorAll('.ne-table-wrap table').forEach(table=>tableLabels(table,'policy'));
 const cart=document.getElementById('sod_bsk');if(cart)cart.classList.toggle('noa-cart-empty',!!cart.querySelector('.empty_table,.empty_list')&&!cart.querySelector('input[name="ct_chk[]"],input[name="ct_id[]"]'));
 memberPresentation();
 fieldLabel('wr_subject','제목');fieldLabel('wr_content','내용');fieldLabel('wr_link1','관련 링크 1');fieldLabel('wr_link2','관련 링크 2');
 // Label an overflow region without inserting wrappers into native table/form handlers.
 document.querySelectorAll('.ny-native :is(.tbl_head01,.tbl_head02,.tbl_head03),#bo_list .tbl_wrap,.new_win .tbl_head01,.new_win .tbl_head02,.ne-table-wrap,.ec-product-compare').forEach(el=>{
  if(el.scrollWidth>el.clientWidth+1){
   for(const [name,value] of [['tabindex','0'],['role','region'],['aria-label','목록 · 좌우로 이동하여 전체 보기']])if(!el.hasAttribute(name)){el.setAttribute(name,value);el.dataset.noaScrollOwned=(el.dataset.noaScrollOwned||'')+name+' ';}
  }else if(el.dataset.noaScrollOwned){for(const name of el.dataset.noaScrollOwned.trim().split(' '))el.removeAttribute(name);delete el.dataset.noaScrollOwned;}
 });
}
let pending=false;const schedule=()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;enhance();});};
window.NoaMemberSurfaces={refresh:schedule};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance,{once:true});else enhance();
new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&!n.closest('#bo_v_con,[data-user-content],[contenteditable]')&&(n.matches('form,table,tbody,tr,#bo_w')||n.querySelector('form,table,#bo_w')))))schedule();}).observe(document.body,{childList:true,subtree:true});
window.addEventListener('resize',schedule,{passive:true});
})();
