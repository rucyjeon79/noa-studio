<?php
require __DIR__.'/../subscription/native_fixture.php';require __DIR__.'/../../bridge/support-core.php';
$t=['owner'=>'s_receiver','channelId'=>hash('sha256','s_receiver'),'channelTitle'=>'검수','entity'=>'song:race','title'=>'동시 후원'];$b=['type'=>'music','key'=>'race','channelId'=>$t['channelId'],'entity'=>$t['entity'],'amount'=>1000,'message'=>'','confirmed'=>true];
$r=nsp_send('s_race','cc000000-0000-4000-8000-000000000001',$b,fn()=>$t);unset($r['replayed']);echo json_encode($r);
