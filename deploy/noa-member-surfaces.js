/* Member-facing presentation only: keep native controls, values, actions and handlers. */
(()=>{'use strict';
if(/^\/adm\//.test(location.pathname)||window.NoaMemberSurfaces)return;
const root=document.documentElement;root.classList.add('noa-member-ui');
const tableScope='#sod_bsk table,#sod_frm table,#sod_fin table,#sod_v table,#sod_inquiry table';
function tableLabels(table){
 if(table.closest('#sod_frm_orderer,#sod_frm_taker')||(!table.tHead&&table.querySelector('th')&&table.querySelector('input,select,textarea'))){table.classList.add('noa-native-form-table');return;}
 if(!table.tHead)return;
 const heads=[...table.tHead.rows].at(-1);if(!heads)return;
 const labels=[];for(const cell of heads.cells)for(let i=0;i<cell.colSpan;i++)labels.push(cell.textContent.trim());
 // Multi-row/rowspan order tables keep their native scrollable layout.
 if([...table.rows].some(row=>[...row.cells].some(cell=>cell.rowSpan>1)))return;
 table.classList.add('noa-native-order-table');
 for(const body of table.tBodies)for(const row of body.rows){let index=0;for(const cell of row.cells){
  if(cell.colSpan===1&&labels[index])cell.dataset.noaColumn=labels[index];index+=cell.colSpan;
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
function enhance(){
 document.querySelectorAll(tableScope).forEach(tableLabels);
 const cart=document.getElementById('sod_bsk');if(cart)cart.classList.toggle('noa-cart-empty',!!cart.querySelector('.empty_table,.empty_list')&&!cart.querySelector('input[name="ct_chk[]"],input[name="ct_id[]"]'));
 fieldLabel('wr_subject','제목');fieldLabel('wr_content','내용');fieldLabel('wr_link1','관련 링크 1');fieldLabel('wr_link2','관련 링크 2');
 // Label an overflow region without inserting wrappers into native table/form handlers.
 document.querySelectorAll('.ny-native :is(.tbl_head01,.tbl_head02,.tbl_head03),#bo_list .tbl_wrap').forEach(el=>{
  if(el.scrollWidth>el.clientWidth+1){if(!el.hasAttribute('tabindex'))el.tabIndex=0;if(!el.hasAttribute('role'))el.setAttribute('role','region');if(!el.hasAttribute('aria-label'))el.setAttribute('aria-label','목록 · 좌우로 이동하여 전체 보기');}
 });
}
let pending=false;const schedule=()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;enhance();});};
window.NoaMemberSurfaces={refresh:schedule};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance,{once:true});else enhance();
new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&!n.closest('#bo_v_con,[data-user-content],[contenteditable]')&&(n.matches('form,table,tbody,tr,#bo_w')||n.querySelector('form,table,#bo_w')))))schedule();}).observe(document.body,{childList:true,subtree:true});
window.addEventListener('resize',schedule,{passive:true});
})();
