<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/hub-release.php';
function must(bool $v,string $label):void{if(!$v)throw new RuntimeException($label);echo "PASS $label\n";}
function rejects(callable $fn,string $needle):void{try{$fn();}catch(Throwable $e){must(str_contains($e->getMessage(),$needle),$needle);return;}throw new RuntimeException('expected rejection: '.$needle);}
$base=sys_get_temp_dir().'/hub-test-'.bin2hex(random_bytes(6));$root=$base.'/private';$web=$base.'/html';mkdir($root,0700,true);mkdir($web,0700);mkdir($web.'/noa-app',0700);mkdir($web.'/noa-app/engine',0700);
try{
 $manifest=json_decode(file_get_contents(dirname(__DIR__,2).'/config/n80-hub-operations.json'),true);
 must(!array_diff_key($manifest,n80_hub_operations())&&!array_diff_key(n80_hub_operations(),$manifest),'fixed scheduler and PHP operation lists agree');
 n80_hub_write($root,'control.json',['revision'=>1,'activeOperations'=>['hub.verify'],'paused'=>false]);
 $key=str_repeat('a',64);$raw='{}';$ts=(string)time();$nonce=str_repeat('1',32);$sig=hash_hmac('sha256',"N80-HUB-1\n".hash('sha256',$raw)."\n".$ts."\n".$nonce,$key);
 must(n80_hub_auth($raw,['time'=>$ts,'nonce'=>$nonce,'signature'=>$sig],$key,time()),'valid scoped HMAC');
 must(!n80_hub_auth('{"x":1}',['time'=>$ts,'nonce'=>$nonce,'signature'=>$sig],$key,time()),'body alteration rejected');
 must(!n80_hub_auth($raw,['time'=>$ts,'nonce'=>$nonce,'signature'=>$sig],$key,time()+181),'expired authentication rejected');
 n80_hub_nonce($root,$nonce,time());rejects(fn()=>n80_hub_nonce($root,$nonce,time()),'hub_replay');
 rejects(fn()=>n80_hub_execute($root,'hub.verify',str_repeat('1',32),fn()=>['ok'=>true]),'hub_invocation_expired');
 $calls=0;$invocation=fn($c)=>str_pad(dechex(time()),8,'0',STR_PAD_LEFT).str_repeat($c,24);$id=$invocation('2');$fn=function()use(&$calls){$calls++;return ['ok'=>true];};
 $one=n80_hub_execute($root,'hub.verify',$id,$fn);$two=n80_hub_execute($root,'hub.verify',$id,$fn);
 must($calls===1&&$one['receipt']['state']==='succeeded'&&!empty($two['duplicate']),'lost response idempotency');
 rejects(fn()=>n80_hub_execute($root,'ai.text',$invocation('3'),$fn),'not_active');
 n80_hub_write($root,'receipts.json',[['id'=>str_repeat('3',32),'operation'=>'hub.verify','state'=>'running','startedAt'=>1]]);
 rejects(fn()=>n80_hub_execute($root,'hub.verify',$invocation('4'),$fn),'unconfirmed');
 foreach(['../common.php','data/dbconfig.php','noa-app/../common.php','noa-bridge//a.php','common.php']as $p)rejects(fn()=>n80_hub_target($web,$p),'not_allowed');
 symlink($base,$web.'/noa-app/linked');rejects(fn()=>n80_hub_target($web,'noa-app/linked/test.php'),'unsafe');
 $data='<?php echo "valid";';$package=['version'=>1,'id'=>str_repeat('5',32),'files'=>[['path'=>'noa-hub-test.php','beforeSha256'=>null,'bytes'=>strlen($data),'sha256'=>hash('sha256',$data),'data'=>base64_encode($data)]]];
 $r=n80_hub_release_apply($root,$web,$package,0);must($r['revision']===1&&file_get_contents($web.'/noa-hub-test.php')===$data,'native deployment readback');
 must(n80_hub_release_apply($root,$web,$package,0)['duplicate']===true,'deployment response retry');
 $bad=$package;$bad['files'][0]['data']=base64_encode('bad');rejects(fn()=>n80_hub_package($bad,$web),'checksum');
 $bad=$package;$bad['id']=str_repeat('6',32);rejects(fn()=>n80_hub_release_apply($root,$web,$bad,0),'revision_changed');
 rejects(fn()=>n80_hub_release_apply($root,$web,$bad,1),'source_changed');
 $bad=$package;$bad['files'][0]['data']=base64_encode('<?php function (');$bad['files'][0]['bytes']=strlen('<?php function (');$bad['files'][0]['sha256']=hash('sha256','<?php function (');rejects(fn()=>n80_hub_package($bad,$web),'syntax');
 $bad=$package;$bad['files'][]=$bad['files'][0];rejects(fn()=>n80_hub_package($bad,$web),'duplicate');
 $before=file_get_contents($web.'/noa-hub-test.php');$after='<?php echo "interrupted";';$saved=n80_hub_read($root,'source.json');$hist=n80_hub_read($root,'releases.json');
 $journal=['id'=>str_repeat('7',32),'packageSha256'=>str_repeat('8',64),'source'=>$saved,'history'=>$hist,'files'=>[['path'=>'noa-hub-test.php','before'=>base64_encode($before),'after'=>hash('sha256',$after)]]];
 n80_hub_write($root,'journal.json',$journal);file_put_contents($web.'/noa-hub-test.php',$after);n80_hub_write($root,'source.json',['revision'=>99]);
 must(n80_hub_release_recover($root,$web)&&file_get_contents($web.'/noa-hub-test.php')===$before&&n80_hub_read($root,'source.json')===$saved,'interrupted deployment recovery restores source revision');
 n80_hub_write($root,'journal.json',$journal);file_put_contents($web.'/noa-hub-test.php','concurrent edit');
 must(!n80_hub_release_recover($root,$web)&&file_get_contents($web.'/noa-hub-test.php')==='concurrent edit'&&count(n80_hub_read($root,'journal.json'))>0,'recovery preserves concurrent source');
 must(n80_hub_owner('hub.verify',$root)==='n80_hub'&&n80_hub_owner('ai.text',$root)==='legacy','single execution ownership');
 must(n80_hub_request('hub.verify',$root)==='requested','wake is host metadata only');
 n80_hub_write($root,'control.json',['revision'=>2,'paused'=>true,'activeOperations'=>['hub.verify','ai.text','ai.batch']]);
 must(n80_hub_legacy_action('n80_tick',$root)==='n80_hub'&&n80_hub_legacy_action('n80_batch_watchdog',$root)==='n80_hub'&&n80_hub_legacy_action('claim',$root)===null,'old workflow fenced even when paused; media owner unchanged');
 echo "N80_HUB_TESTS_PASSED\n";
}finally{
 $it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($base,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);foreach($it as $f){if($f->isDir()&&!$f->isLink())rmdir($f->getPathname());else unlink($f->getPathname());}rmdir($base);
}
