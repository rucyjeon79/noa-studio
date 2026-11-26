(() => {
  'use strict';
  const logo = new URL('reporter-logo.svg', document.currentScript.src).href;
  const identityLink = /(?:\/(?:profile|memo_form|formmail)\.php|win_(?:profile|memo|email)\s*\(|(?:mb_id|me_recv_mb_id)=)/i;
  const messageText = /^(?:메시지\s*보내기|쪽지\s*보내기|자기소개|회원정보)$/;
  function isMemberControl(node) {
    return identityLink.test([node.getAttribute('href'),node.getAttribute('onclick'),node.getAttribute('data-href'),node.getAttribute('data-url')].join(' '))
      || messageText.test((node.textContent||'').trim())
      || messageText.test((node.getAttribute('title')||'').trim())
      || messageText.test((node.getAttribute('aria-label')||'').trim());
  }
  function avatarCandidate(img, reporter) {
    if (reporter.contains(img) || img.closest('.bn-reporter') || img.classList.contains('bn-theme-avatar')) return false;
    const r=img.getBoundingClientRect(), n=reporter.getBoundingClientRect();
    const src=[img.getAttribute('src'),img.getAttribute('data-src'),img.className,img.parentElement?.className].join(' ');
    const identifiable=/\/(?:member_image|member|profile)(?:\/|[_-])|profile[_-]?img|profile[_-]?image|avatar|member[_-]?img/i.test(src);
    const near=r.width>=20&&r.height>=20&&r.width<=140&&r.height<=140
      && Math.abs((r.top+r.bottom)/2-(n.top+n.bottom)/2)<135
      && r.left<=n.right+12&&r.right>=n.left-150;
    return identifiable || near;
  }
  function fix(reporter) {
    if(reporter.dataset.bnFixed==='1')return;
    if(!reporter.getBoundingClientRect().width)return;
    let card=null,avatar=null;
    for(let parent=reporter.parentElement,depth=0;parent&&depth<7;parent=parent.parentElement,depth++){
      if(parent.matches('body,main,#bo_v_con,.boardViewWrap,#contentsWrap')||parent.querySelectorAll('.bn-reporter').length!==1)break;
      const candidates=[...parent.querySelectorAll('img')].filter(img=>avatarCandidate(img,reporter));
      if(candidates.length===1){card=parent;avatar=candidates[0];break;}
      if(candidates.length>1)break;
    }
    if(!avatar)return; // The name already contains the dedicated mark as a fallback.
    const avatarLink=avatar.closest('a');
    if(avatarLink&&card.contains(avatarLink)&&!avatarLink.contains(reporter)) {
      avatarLink.replaceWith(avatar);
    }
    for(const attr of ['srcset','sizes','data-src','data-srcset','data-original','data-lazy-src','onerror','onclick','title'])avatar.removeAttribute(attr);
    const picture=avatar.closest('picture');
    if(picture)picture.querySelectorAll('source').forEach(x=>x.remove());
    avatar.src=logo;avatar.alt='ChatGPT';avatar.loading='eager';avatar.classList.add('bn-theme-avatar');
    // The theme image is the one visible avatar; avoid a second mark next to the name.
    reporter.querySelector('.bn-reporter-avatar')?.remove();
    reporter.dataset.bnFixed='1';
    // Only remove real-member controls inside the reporter's identity block.
    // The author name and the avatar may be in different children of the same card.
    let identity=card;
    for(let p=card,depth=0;p&&depth<3;p=p.parentElement,depth++){
      if(p.matches('body,main,#bo_v_con,.boardViewWrap,#contentsWrap')||p.querySelectorAll('.bn-reporter').length!==1)break;
      if([...p.querySelectorAll('a,button,[role="button"]')].some(isMemberControl)){identity=p;break;}
    }
    identity.querySelectorAll('a,button,[role="button"]').forEach(node=>{
      if(!node.contains(reporter)&&!node.contains(avatar)&&isMemberControl(node))node.remove();
    });
    identity.dataset.bnReporterCard='1';
  }
  // Move the real share control (and its existing listener), never make a second one.
  // Only the reporter's article author card is eligible; ordinary boards are unchanged.
  function placeShare() {
    const wrap=document.querySelector('.boardViewWrap');
    const button=wrap?.querySelector('.bn-article-share[data-kind="article"]');
    const identity=wrap?.querySelector('[data-bn-reporter-card="1"]');
    const name=identity?.querySelector('.bn-reporter');
    if(!button||!identity||!name||button.dataset.bnReporterShare==='1')return;
    // The inner identity block can be only as wide as the author's text.
    // Locate the actual full-width bordered profile card, not that inner block.
    const wrapRect=wrap.getBoundingClientRect();
    const avatar=identity.querySelector('.bn-theme-avatar');
    let outer=null,fallback=null;
    for(let p=identity;p&&p!==wrap;p=p.parentElement){
      if(p.matches('body,main,#contentsWrap,#bo_v_con,.boardViewHeader')||p.contains(button))break;
      if(!avatar||!p.contains(avatar)||p.querySelectorAll('.bn-reporter').length!==1)continue;
      const r=p.getBoundingClientRect(),s=getComputedStyle(p);
      if(r.width<wrapRect.width*.82||r.height>260||r.height<35)continue;
      const border=parseFloat(s.borderInlineEndWidth)||0;
      const radius=parseFloat(s.borderTopRightRadius)||0;
      if(border>0&&radius>0){outer=p;break;}
      if(!fallback||r.width>fallback.getBoundingClientRect().width+2)fallback=p;
    }
    outer=outer||fallback;
    if(!outer)return; // Keep the working upper share control if no safe card is found.
    const template=document.getElementById('bn-reporter-compact-template');
    if(!template||outer.querySelector('#bo_v_con,.boardViewHeader,form,textarea'))return;
    // Render the verified reporter's own compact card instead of inheriting
    // the native member-only rows, fixed heights or empty category space.
    const fragment=template.content.cloneNode(true);
    const slot=fragment.querySelector('.bn-reporter-actions');
    if(!slot||!fragment.querySelector('.bn-reporter-info')||!fragment.querySelector('.bn-theme-avatar'))return;
    button.classList.add('bn-reporter-share');
    button.dataset.bnReporterShare='1';
    slot.append(button); // Preserve the actual share listener and touch target.
    outer.replaceChildren(fragment);
    outer.removeAttribute('data-bn-reporter-card');
    outer.style.removeProperty('--bn-author-share-padding');
    outer.classList.add('bn-reporter-share-right','bn-reporter-compact');
    outer.dataset.bnReporterOuter='1';
    outer.dataset.bnReporterCard='1';
  }
  function apply(){
    if(document.getElementById('bn-rights-reading-marker'))document.getElementById('bo_v_con')?.classList.add('bn-rights-reading');
    document.querySelectorAll('.bn-reporter').forEach(fix);placeShare();
  }
  apply();
  document.addEventListener('bn-share-ready',placeShare);
  if(document.readyState!=='complete')window.addEventListener('load',apply,{once:true});
})();