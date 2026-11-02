(()=>{
 const form=document.getElementById('special-invite-issue'),panel=document.getElementById('special-invite-share');
 if(!form||!panel)return;
 const button=form.querySelector('button'),sms=panel.querySelector('a'),copy=panel.querySelector('button'),urlField=panel.querySelector('input'),notice=panel.querySelector('p');
 const title='람준파파의 특별한 별무리 초대장';
 form.onsubmit=async event=>{
  event.preventDefault();if(button.disabled)return;button.disabled=true;
  try{
   const response=await fetch(form.action,{method:'POST',body:new FormData(form),headers:{Accept:'application/json'},credentials:'same-origin'});
   if(!response.ok)throw Error();
   const {url}=await response.json();
   urlField.value=url;sms.href='sms:?body='+encodeURIComponent(title+'\n'+url);
   panel.hidden=false;copy.hidden=false;sms.hidden=false;notice.textContent='별무리 VIP 30일권 · 한 분에게만 전달해 주세요.';
   form.elements.request.value=Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
   if(navigator.share){
    try{await navigator.share({title,text:title,url});}catch{sms.focus();}
   }else{sms.focus();}
  }catch{panel.hidden=false;notice.textContent='초대장을 만들지 못했습니다. 다시 눌러 주세요.';if(!urlField.value){sms.hidden=true;copy.hidden=true;}}
  finally{button.disabled=false;}
 };
 copy.onclick=async()=>{try{await navigator.clipboard.writeText(urlField.value);notice.textContent='초대 링크를 복사했습니다.';}catch{urlField.select();notice.textContent='선택된 링크를 복사해 주세요.';}};
})();
