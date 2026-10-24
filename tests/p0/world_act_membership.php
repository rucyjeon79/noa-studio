<?php
declare(strict_types=1);
require __DIR__.'/../../bridge/world-mv.php';
function act_check(bool $ok,string $message):void{if(!$ok)throw new RuntimeException($message);}
$playlist=['id'=>NWM_ACT_PLAYLIST,'snippet'=>['channelId'=>NWM_CHANNEL],'status'=>['privacyStatus'=>'public']];
function act_video(string $id,string $title):array{return ['id'=>$id,'snippet'=>['title'=>$title,'description'=>"[Verse]\n원문 <script>\n",'channelId'=>NWM_CHANNEL],'status'=>['privacyStatus'=>'public','embeddable'=>true]];}
$videos=['abcdefghij1'=>act_video('abcdefghij1','Noa Story ACT.3 | EP.21~30'), 'abcdefghij2'=>act_video('abcdefghij2','ACT.1 official'), 'abcdefghij3'=>act_video('abcdefghij3','ACT.2 official'), 'abcdefghij4'=>act_video('abcdefghij4','ACT.4 unofficial title'), 'abcdefghij5'=>act_video('abcdefghij5','ACT.1 private'), 'abcdefghij6'=>act_video('abcdefghij6','ACT.1 foreign owner'), 'abcdefghij7'=>act_video('abcdefghij7','ACT.1 and ACT.2 ambiguous')];
$videos['abcdefghij5']['status']['privacyStatus']='private';$videos['abcdefghij6']['snippet']['channelId']='other';
$items=array_map(fn($id)=>['video_id'=>$id],['abcdefghij1','abcdefghij2','abcdefghij3','abcdefghij3','abcdefghij5','abcdefghij6','abcdefghij7','invalid']);
$r=nwm_act_build($playlist,$items,$videos);
act_check(array_column($r['videos'],'videoId')===['abcdefghij2','abcdefghij3','abcdefghij1','abcdefghij7'],'official membership, ACT order, duplicate exclusion and unassigned preservation');
act_check(array_column($r['videos'],'act')===[1,2,3,null],'ACT ranges must not be inferred from EP or list position');
act_check($r['unassigned']===1&&$r['excluded']===2,'private/foreign unavailable and ambiguous ACT evidence');
act_check($r['videos'][0]['description']==="[Verse]\n원문 <script>\n",'original description must remain exact');
act_check(!in_array('abcdefghij4',array_column($r['videos'],'videoId'),true),'title alone must not prove official identity');
foreach(['id','owner','privacy'] as $case){$p=$playlist;if($case==='id')$p['id']='other';if($case==='owner')$p['snippet']['channelId']='other';if($case==='privacy')$p['status']['privacyStatus']='private';try{nwm_act_build($p,$items,$videos);throw new RuntimeException('unverified playlist accepted');}catch(DomainException $e){}}
echo "NOA_ACT_MEMBERSHIP_ORDER_ORIGINAL_PRESERVATION_OK\n";
