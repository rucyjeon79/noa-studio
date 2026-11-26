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
    if(!button||!identity||!name||identity.contains(button))return;
    const n=name.getBoundingClientRect();
    const blanks=[...identity.querySelectorAll('button,a,[role="button"],.button,.btn')]
      .filter(el=>{
        if(el===button||el.contains(name)||el.contains(identity.querySelector('.bn-theme-avatar')))return false;
        if((el.textContent||'').trim()||el.getAttribute('aria-label')||el.getAttribute('title')||el.matches('[aria-hidden="true"]'))return false;
        const r=el.getBoundingClientRect();
        if(r.width<16||r.width>65||r.height<16||r.height>65||r.top<n.bottom-3||r.top>n.bottom+45||Math.abs(r.left-n.left)>38)return false;
        return ![...el.querySelectorAll('img,svg,i,canvas')].some(icon=>{
          const s=getComputedStyle(icon), box=icon.getBoundingClientRect();
          return s.display!=='none'&&s.visibility!=='hidden'&&box.width>2&&box.height>2;
        });
      }).sort((a,b)=>Math.abs(a.getBoundingClientRect().top-n.bottom)-Math.abs(b.getBoundingClientRect().top-n.bottom));
    // Remove the former empty member action and its now-empty row only.
    // Never remove author, metadata, category or real controls.
    if(blanks.length){
      let parent=blanks[0].parentElement;
      blanks[0].remove();
      for(let depth=0;parent&&parent!==identity&&depth<3;depth++){
        if(parent.contains(name)||parent.contains(identity.querySelector('.bn-theme-avatar'))
          ||(parent.textContent||'').trim()||parent.querySelector('a,button,input,img,svg,i,canvas,[role="button"]'))break;
        const next=parent.parentElement;
        parent.remove();parent=next;
      }
    }
    // Preserve the theme's existing padding and reserve only the right-side
    // width necessary for a 44px touch target. No separate action row.
    const padding=parseFloat(getComputedStyle(identity).paddingInlineEnd)||0;
    identity.style.setProperty('--bn-author-share-padding',Math.max(padding,12)+52+'px');
    identity.classList.add('bn-reporter-share-right');
    button.classList.add('bn-reporter-share');
    identity.append(button);
    button.dataset.bnReporterShare='1';
  }
  function apply(){document.querySelectorAll('.bn-reporter').forEach(fix);placeShare();}
  apply();
  document.addEventListener('bn-share-ready',placeShare);
  if(document.readyState!=='complete')window.addEventListener('load',apply,{once:true});
})();