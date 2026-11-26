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
  function apply(){document.querySelectorAll('.bn-reporter').forEach(fix);}
  apply();
  if(document.readyState!=='complete')window.addEventListener('load',apply,{once:true});
})();