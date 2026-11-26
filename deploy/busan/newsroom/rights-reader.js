(() => {
  'use strict';
  const blocked='script,style,form,iframe,object,embed,template,[contenteditable="true"]';
  const structural='P,DIV,SECTION,ARTICLE,H1,H2,H3,H4,H5,H6,UL,OL,DL,TABLE,FIGURE,BLOCKQUOTE,PRE,HR';
  const isBlock=n=>n.nodeType===1&&structural.split(',').includes(n.tagName);
  const blank=n=>n.nodeType===3&&!n.textContent.trim();
  const classify=node=>{
    const text=(node.textContent||'').trim();
    if(!text||text.length>125)return '';
    if(/^(?:Q\s*[.:：]|질문\s*[:：]|문\s*[:：])/i.test(text))return 'question';
    if(/^(?:A\s*[.:：]|답변\s*[:：]|답\s*[:：])/i.test(text))return 'answer';
    if(/^(?:예시|사례|현장 사례)\s*[:：]/.test(text))return 'example';
    if(/^(?:체크리스트|확인할 것|대응 방법|대처 방법|실천 방법)\s*[:：]?$/.test(text))return 'check';
    if(node.nodeType===1&&/^H[1-6]$/.test(node.tagName))return 'heading';
    if(node.nodeType===1&&node.matches('p,div')&&node.children.length===1&&node.firstElementChild.matches('strong,b')&&node.firstElementChild.textContent.trim()===text)return 'heading';
    if(/^(?:■|◆|▶|【|\d{1,2}[.)]\s|[①-⑳])/.test(text)&&text.length<85)return 'heading';
    return '';
  };
  function format(root){
    if(!root||root.querySelector('.bn-rights-guide,.bn-rights-legacy')||root.querySelector(blocked))return false;
    // Follow the actual editor wrapper, but never unwrap tables or media.
    let target=root;
    for(let i=0;i<4;i++){
      const significant=[...target.childNodes].filter(n=>!blank(n)&&n.nodeType!==8);
      if(significant.length!==1||significant[0].nodeType!==1||!significant[0].matches('div,section,article'))break;
      if(significant[0].matches('[id],.bn-rights-guide')||significant[0].querySelector(blocked))break;
      target=significant[0];
    }
    const original=[...target.childNodes];
    if(!original.some(n=>(n.textContent||'').trim()||n.nodeType===1))return false;
    const guide=document.createElement('div');
    guide.className='bn-rights-guide bn-rights-legacy';
    let card=null,kind='',count=0;
    const start=(type='plain')=>{
      card=document.createElement('div');
      card.className='bn-rights-section-card bn-rights-'+type;
      guide.append(card);kind=type;count=0;
    };
    // Existing editor nodes are moved, never copied, parsed as new HTML or deleted.
    // Direct BR-separated lines also keep their original text and BR elements.
    for(const node of original){
      if(blank(node)||node.nodeType===8){(card||guide).append(node);continue;}
      const type=classify(node);
      if(type){start(type);if(node.nodeType===1)node.classList.add('bn-rights-original-heading');}
      else if(!card||count>=3||(kind==='plain'&&count>0&&isBlock(node)))start();
      card.append(node);
      if(isBlock(node)||node.nodeType===1&&node.tagName==='BR')count++;
    }
    target.append(guide);
    // For older editors that store several lines inside one paragraph, style
    // the original line breaks and emphasis rather than inventing headings.
    guide.querySelectorAll('p,div').forEach(el=>{
      if(el.classList.contains('bn-rights-section-card'))return;
      if(el.querySelector(':scope > br'))el.classList.add('bn-rights-lines');
    });
    root.dataset.bnRightsFormatted='1';
    return true;
  }
  if(document.getElementById('bn-rights-reading-marker')){
    const root=document.getElementById('bo_v_con');
    if(root){root.classList.add('bn-rights-reading');format(root);}
  }
})();