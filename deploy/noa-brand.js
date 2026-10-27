/* Original brand mark plus opaque installation assets for OS icon masks. */
(()=>{'use strict';if(window.NoaBrand)return;
 function apply(){
  for(const [rel,href,type] of [['icon','/noa-assets/favicon.png?v=original-symbol-1','image/png'],['apple-touch-icon','/noa-assets/icon-touch-180.png?v=fullbleed-20261027','image/png'],['manifest','/noa-manifest.json?v=fullbleed-20261027','']]){
   let link=document.head.querySelector('link[data-noa-brand="'+rel+'"]');if(rel==='manifest'){const existing=document.head.querySelector('link[rel="manifest"]');if(existing&&new URL(existing.href,location.href).pathname==='/noa-manifest.json'){existing.dataset.noaBrand=rel;existing.href=href;continue;}}if(!link){for(const old of document.head.querySelectorAll(rel==='icon'?'link[rel="icon"],link[rel="shortcut icon"]':'link[rel="'+rel+'"]'))old.remove();link=document.createElement('link');link.rel=rel;link.dataset.noaBrand=rel;document.head.append(link);}link.href=href;if(type)link.type=type;
  }
  for(const logo of document.querySelectorAll('.noa-logo')){if(logo.querySelector('.noa-brand-mark'))continue;const copy=document.createElement('span');copy.className='noa-brand-copy';while(logo.firstChild)copy.append(logo.firstChild);const image=document.createElement('img');image.className='noa-brand-mark';image.src='/noa-assets/papa-logo.png';image.alt='';image.width=44;image.height=44;image.decoding='async';logo.append(image,copy);}
 }
 window.NoaBrand={apply};apply();
})();
