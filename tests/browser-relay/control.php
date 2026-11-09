<?php
declare(strict_types=1);
$root=sys_get_temp_dir().'/n80-browser-test-'.bin2hex(random_bytes(8));mkdir($root.'/html',0700,true);mkdir($root.'/noa-ai-lab',0700);define('_GNUBOARD_',true);define('G5_PATH',$root.'/html');file_put_contents($root.'/noa-ai-lab/master.key',random_bytes(32));
require __DIR__.'/../../bridge/lab-core.php';require __DIR__.'/../../bridge/browser-control.php';
function check(bool $ok,string $why):void {if(!$ok)throw new RuntimeException($why);}
function refuses(callable $fn,string $why):void{try{$fn();}catch(Throwable $e){check($e->getMessage()===$why,$e->getMessage());return;}throw new RuntimeException('did_not_refuse_'.$why);}
try{
 $s=lab_defaults();$open=nb_admin($s,['command'=>'open'],'owner',100);$id=$open['id'];
 check(nb_admin($s,['command'=>'open'],'owner',101)['id']===$id,'duplicate_session');
 refuses(function()use(&$s){nb_admin($s,['command'=>'open'],'other',101);},'browser_in_use');
 check(nb_view($s,'other',101)===['state'=>'disconnected'],'owner_leak');
 $claim=nb_worker($s,['command'=>'claim'],101);$auth=['id'=>$id,'lease'=>$claim['lease']];
 check(!nb_worker($s,['command'=>'claim'],102)['claimed'],'double_claim');
 $starting=nb_view($s,'owner',102);check($starting['state']==='active'&&$starting['phase']==='starting'&&!$starting['inputReady']&&!isset($starting['frame']),'blank_browser_marked_ready');
 check($starting['waitSeconds']===2,'startup_elapsed_time');
 refuses(function()use(&$s,$id){nb_admin($s,['command'=>'save','id'=>$id],'owner',102);},'browser_not_ready');

 $frame=['url'=>'https://accounts.google.com/','image'=>'data:image/jpeg;base64,ZmFrZQ=='];
 nb_worker($s,$auth+['command'=>'exchange','ack'=>0,'frame'=>$frame],103);
 $view=nb_view($s,'owner',104);check(!isset($view['lease'])&&!isset($view['input']),'private_state_leak');
 check($view['phase']==='active'&&$s['browserControl']['firstFrameAt']===103&&$view['inputReady']&&$view['frameSeq']===1&&$view['productionReady']===false,'screen_missing');
 nb_worker($s,$auth+['command'=>'exchange','ack'=>0,'frame'=>$frame],104);check($s['browserControl']['frameSeq']===1,'unchanged_frame_invalidated');
 $input=['command'=>'input','id'=>$id,'frameSeq'=>1,'event'=>['kind'=>'type','text'=>'DUMMY_PASSWORD']];
 nb_admin($s,$input,'owner',105);check(!str_contains(json_encode($s),'DUMMY_PASSWORD'),'input_not_encrypted');
 refuses(function()use(&$s,$input){nb_admin($s,$input,'owner',106);},'browser_frame_changed');
 $reply=nb_worker($s,$auth+['command'=>'exchange','ack'=>0],106);check($reply['input']['seq']===1&&$reply['input']['event']['text']==='DUMMY_PASSWORD','input_missing');
 $repeat=nb_worker($s,$auth+['command'=>'exchange','ack'=>0],107);check($repeat['input']===$reply['input'],'lost_response_changed_command');
 nb_worker($s,$auth+['command'=>'exchange','ack'=>1],108);check(nb_view($s,'owner',108)['inputReady'],'ack_not_cleared');
 refuses(function()use(&$s,$auth){nb_worker($s,$auth+['command'=>'exchange','ack'=>0],109);},'browser_ack_invalid');
 refuses(function()use(&$s,$auth){nb_worker($s,$auth+['command'=>'exchange','ack'=>2],109);},'browser_ack_invalid');
 check(nb_url('https://flow.google.com/'),'official_flow_origin');
 foreach(['https://flow.google.com.evil.test','http://gemini.google.com','https://gemini.google.com.evil.test','https://x@gemini.google.com','https://gemini.google.com:443','file:///etc/passwd'] as $url)check(!nb_url($url),'unsafe_url');
 nb_admin($s,['command'=>'save','id'=>$id],'owner',110);
 $stop=nb_worker($s,$auth+['command'=>'exchange','ack'=>1],111);check($stop['stop']&&$stop['save'],'save_not_requested');
 $data=random_bytes(40);$sha=hash('sha256',$data);$profile=['sha256'=>$sha,'bytes'=>40];
 refuses(function()use(&$s,$auth,$profile){nb_worker($s,$auth+['command'=>'finish','profile'=>$profile],112);},'browser_profile_checksum');
 file_put_contents(lab_root().'/browser-profile-'.$sha.'.enc',$data);
 $finish=nb_worker($s,$auth+['command'=>'finish','profile'=>$profile],112);check($finish['state']==='saved'&&!$finish['productionReady'],'profile_finish');
 check(!isset($s['browserControl']['frame'])&&!isset($s['browserControl']['input']),'ephemeral_frame_retained');
 nb_worker($s,$auth+['command'=>'fail'],113);check($s['browserControl']['state']==='saved','late_failure_replaced_success');
 $s2=lab_defaults();nb_admin($s2,['command'=>'open'],'owner',100);$c=nb_worker($s2,['command'=>'claim'],101);
 check(nb_view($s2,'owner',282)['state']==='connection_lost','dead_worker_hidden');
 refuses(function()use(&$s2,$c){nb_worker($s2,['command'=>'exchange','ack'=>0,'id'=>$c['id'],'lease'=>$c['lease']],282);},'browser_lease_expired');
 nb_admin($s2,['command'=>'close','id'=>$c['id']],'owner',283);$stop=nb_worker($s2,['command'=>'exchange','ack'=>0,'id'=>$c['id'],'lease'=>$c['lease']],284);check($stop['stop']&&!$stop['save'],'cancel_saved_profile');
 echo "N80_BROWSER_CONTROL_OK ownership lease encryption replay expiry profile-checksum\n";
}finally{foreach(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST) as $f){$f->isDir()?rmdir($f->getPathname()):unlink($f->getPathname());}rmdir($root);}
