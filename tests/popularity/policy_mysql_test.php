<?php
/** Only a fresh disposable schema on the explicit loopback MySQL test service. */
declare(strict_types=1);
if(getenv('NOA_PLAYCOUNT_TEST_MYSQL')!=='1'||(getenv('NOA_PLAYCOUNT_TEST_HOST')?:'127.0.0.1')!=='127.0.0.1')throw new RuntimeException('explicit loopback MySQL fixture required');
$port=(int)(getenv('NOA_PLAYCOUNT_TEST_PORT')?:3306);if($port<1||$port>65535)throw new RuntimeException('invalid test port');
define('_GNUBOARD_',true);
require __DIR__.'/../../bridge/popularity-store.php';require __DIR__.'/../../bridge/playcount-policy.php';
$db=new PDO('mysql:host=127.0.0.1;port='.$port.';charset=utf8mb4',getenv('NOA_PLAYCOUNT_TEST_USER')?:'root',getenv('NOA_PLAYCOUNT_TEST_PASSWORD')?:'noa-test-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
$schema='noa_policy_test_'.bin2hex(random_bytes(6));$root=sys_get_temp_dir().'/noa-policy-source-'.bin2hex(random_bytes(6));$created=false;$assertions=0;
function demand(bool $ok,string $message):void{global $assertions;if(!$ok)throw new RuntimeException($message);$assertions++;}
function denied(callable $call,string $reason):void{try{$call();}catch(DomainException|InvalidArgumentException $e){demand($e->getMessage()===$reason,'wrong rejection');return;}throw new RuntimeException('unsafe request accepted');}
try{
 $db->exec('CREATE DATABASE `'.$schema.'`');$created=true;$db->exec('USE `'.$schema.'`');
 $definition=(require __DIR__.'/../../bridge/popularity-schema.php')['noa_popularity_settings'];$db->exec('CREATE TABLE noa_popularity_settings '.$definition.' ENGINE=InnoDB');
 mkdir($root.'/noa-app/jukebox',0700,true);
 foreach(['noa-app/jukebox/stream.php','noa-app/jukebox/stream-popularity.php','noa-playcount.js','noa-music.php']as $file)file_put_contents($root.'/'.$file,'fixture:'.$file);
 $original=np_defaults();$original['minimumSeconds']=45;if(getenv('NOA_POLICY_BACKUP_FILE')){$backup=json_decode(file_get_contents(getenv('NOA_POLICY_BACKUP_FILE')),true,32,JSON_THROW_ON_ERROR);$original=$backup['policy']['values'];np_validate_policy($original);demand(hash('sha256',npp_policy_json($original))===$backup['policySha256'],'Drive policy restoration hash');}
 $q=$db->prepare('INSERT INTO noa_popularity_settings(id,policy,revision,updated_by) VALUES(1,?,7,?)');$q->execute([np_json($original),'fixture']);
 $before=npp_apply($db,$root,['action'=>'inspect']);demand($before['policy']==$original&&$before['revision']===7&&!$before['changed'],'inspect mutated values');
 $set=['action'=>'set','expectedRevision'=>7,'expectedPolicySha256'=>$before['policySha256'],'enabled'=>true,'expectedSources'=>$before['sources']];
 $after=npp_apply($db,$root,$set);$expected=$original;$expected['playbackIntegrationEnabled']=true;
 demand($after['policy']==$expected&&$after['revision']===8&&$after['changed'],'enable changed another value or revision');
 demand($db->query('SELECT updated_by FROM noa_popularity_settings WHERE id=1')->fetchColumn()==='n80_deployment','unexpected author');
 denied(fn()=>npp_apply($db,$root,$set),'policy_conflict');
 $set['expectedRevision']=8;$set['expectedPolicySha256']=str_repeat('0',64);denied(fn()=>npp_apply($db,$root,$set),'policy_conflict');
 $set['expectedPolicySha256']=$after['policySha256'];$set['expectedSources']['noa-music.php']=str_repeat('0',64);denied(fn()=>npp_apply($db,$root,$set),'source_conflict');
 $set['expectedSources']=$after['sources'];file_put_contents($root.'/noa-music.php','other Work changed source');denied(fn()=>npp_apply($db,$root,$set),'source_conflict');file_put_contents($root.'/noa-music.php','fixture:noa-music.php');
 $malformed=$set;$malformed['enabled']='true';denied(fn()=>npp_apply($db,$root,$malformed),'invalid_cas');
 $malformed=$set;$malformed['minimumSeconds']=30;denied(fn()=>npp_apply($db,$root,$malformed),'invalid_request');
 $noop=npp_apply($db,$root,$set);demand(!$noop['changed']&&$noop['revision']===8,'identical policy rewrote row');
 $set['enabled']=false;$off=npp_apply($db,$root,$set);demand($off['policy']==$original&&$off['revision']===9,'disable modified other policy fields');
 demand((int)$db->query('SELECT COUNT(*) FROM noa_popularity_settings')->fetchColumn()===1,'additional settings created');
 $raw='{"action":"inspect"}';$ts=(string)time();$nonce=str_repeat('b',32);$key=str_repeat('a',64);$sig=hash_hmac('sha256',"N80-PLAYCOUNT-POLICY-1\n".hash('sha256',$raw)."\n".$ts."\n".$nonce,$key);
 demand(npp_auth($raw,$ts,$nonce,$sig,$key,(int)$ts),'valid service authentication rejected');
 demand(!npp_auth($raw.' ',$ts,$nonce,$sig,$key,(int)$ts),'body tamper accepted');
 demand(!npp_auth($raw,$ts,$nonce,$sig,$key,(int)$ts+181),'expired signature accepted');
 demand(!npp_auth($raw,$ts,str_repeat('c',32),$sig,$key,(int)$ts),'nonce tamper accepted');
 demand(!npp_auth($raw,$ts,$nonce,hash_hmac('sha256','wrong-domain',$key),$key,(int)$ts),'domain separation missing');
 echo json_encode(['policyCAS'=>true,'otherValuesPreserved'=>true,'sourceConflictsRejected'=>true,'replayRejected'=>true,'authenticatedBodyBound'=>true,'assertions'=>$assertions],JSON_THROW_ON_ERROR)."\n";
}finally{
 if($created)$db->exec('DROP DATABASE `'.$schema.'`');
 foreach(['noa-app/jukebox/stream.php','noa-app/jukebox/stream-popularity.php','noa-playcount.js','noa-music.php']as $file)if(is_file($root.'/'.$file))unlink($root.'/'.$file);
 foreach(['/noa-app/jukebox','/noa-app','']as $dir)if(is_dir($root.$dir))rmdir($root.$dir);
}
