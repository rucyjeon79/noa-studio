<?php
require __DIR__.'/../premium/fixture.php';
copy('deploy/noa-app/monthly-banner.php',$root.'/noa-app/monthly-banner.php');
file_put_contents($root.'/common.php',"\nfunction nmb_rules(){return (\$_COOKIE['qa_monthly']??'on')==='off'?null:['enabled'=>true];}\n",FILE_APPEND);
file_put_contents($root.'/monthly-collections.php', <<<'CODE'
<?php require __DIR__.'/common.php';?><!doctype html><html lang="ko" data-noa-precision="true"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-engagement.css"><script src="/noa-ui.js" defer></script><script src="/noa-browse.js" defer></script><script src="/noa-engagement.js" defer></script><script type="application/json" id="noa-engagement-context">{"member":true}</script></head><body class="noa-page"><main><div id="browse"></div></main><script>document.addEventListener('DOMContentLoaded',()=>{const rows=[];for(let act=1;act<=4;act++){rows.push({key:'act-'+act,kind:'playlist',act,genre:'kpop-original',title:'ACT '+act,video:'video00000'+act});for(let i=1;i<=10;i++)rows.push({key:'video-'+act+'-'+i,genre:'kpop-original',ep:(act-1)*10+i,title:'하루의 끝에',video:'video00000'+act});}let ui;const refresh=()=>ui?.apply(rows);ui=NoaBrowse.mount({host:document.getElementById('browse'),rows,kind:'영상',onChange:refresh});ui.apply(rows);});</script></body></html>
CODE);
echo "MONTHLY_FIXTURE_READY\n";
