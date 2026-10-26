(()=>{'use strict';
const tabs=document.querySelector('.lab-tabs');if(!tabs)return;
const links=[...tabs.querySelectorAll('a[href^="#lab-"]')],panels=links.map(a=>document.querySelector(a.hash)).filter(Boolean);
function show(hash,scroll=true){if(hash==='#settings'){document.getElementById('lab-config-open')?.click();hash='#lab-text';}const target=panels.find(p=>'#'+p.id===hash)||panels[0];for(const panel of panels)panel.hidden=panel!==target;for(const link of links){const active=link.hash==='#'+target.id;link.setAttribute('aria-current',active?'page':'false');}if(scroll)target?.scrollIntoView({block:'start',behavior:'instant'});}
for(const link of links)link.addEventListener('click',()=>show(link.hash));window.addEventListener('hashchange',()=>show(location.hash));window.addEventListener('DOMContentLoaded',()=>show(location.hash,!!location.hash));
})();
