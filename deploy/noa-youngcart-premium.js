/* Native Youngcart presentation adapter; no cart or payment mutations. */
(()=>{'use strict';document.documentElement.classList.add('ny-native');document.body.classList.add('ny-native-page');
if(document.querySelector('.ny-native-nav'))return;
const nav=document.createElement('nav');nav.className='ny-native-nav';nav.setAttribute('aria-label','NOA 스토어');
for(const [label,url] of [['NOA STUDIO','/'],['스토어','/noa-youngcart.php'],['장바구니','/shop/cart.php'],['주문 내역','/shop/orderinquiry.php']]){const a=document.createElement('a');a.textContent=label;a.href=url;if(location.pathname===url)a.setAttribute('aria-current','page');nav.append(a);}
const wrapper=document.getElementById('wrapper');if(wrapper)wrapper.before(nav);else document.body.prepend(nav);
const title=document.getElementById('wrapper_title');if(title)title.setAttribute('role','heading');if(title)title.setAttribute('aria-level','1');
})();
