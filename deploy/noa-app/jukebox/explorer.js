(()=>{'use strict';
 const button=document.getElementById('jukebox-explore');
 const records=JSON.parse(document.getElementById('jukebox-choices').textContent);
 button.onclick=async()=>{
  button.disabled=true;
  try{const song=await N80Explorer.choose({records,title:'음원 업로드·최적화'});if(song){const url=new URL(location.href);url.searchParams.set('song',song.key);location.assign(url);}}
  finally{button.disabled=false;}
 };
})();
