/* Retire cached legacy injectors. The explicit 홈페이지 관리 menu owns this entry. */
(()=>{'use strict';document.querySelectorAll('[data-noa-database-link]').forEach(a=>{const p=a.parentElement;a.remove();if(p?.tagName==='LI'&&!p.childElementCount)p.remove();});})();
