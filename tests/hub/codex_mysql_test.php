<?php
declare(strict_types=1);
function check(bool $ok,string $label):void{if(!$ok)throw new RuntimeException($label);echo "PASS $label\n";}
function rejected(callable $fn,string $message):void{try{$fn();}catch(DomainException $e){check($e->getMessage()===$message,$message);return;}throw new RuntimeException('expected rejection: '.$message);}
$repo=dirname(__DIR__,2);$base=sys_get_temp_dir().'/n80-codex-'.bin2hex(random_bytes(8));$web=$base.'/html';$root=$base.'/noa-hub';mkdir($root.'/codex',0700,true);
foreach(['hub.php','codex.php']as $f){@mkdir($web.'/noa-app/engine',0700,true);copy($repo.'/deploy/noa-app/engine/'.$f,$web.'/noa-app/engine/'.$f);}
foreach(['ainoa-automation.php','ainoa-generation.php','ainoa-core.php','sound-core.php']as $f){@mkdir($web.'/noa-bridge',0700,true);copy($repo.'/bridge/'.$f,$web.'/noa-bridge/'.$f);}
require $web.'/noa-app/engine/codex.php';
$db=new PDO('mysql:host=127.0.0.1;port=3306;dbname=noa_hub_test;charset=utf8mb4','root','hub-test-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$db->exec('CREATE TABLE noa_documents(doc_key VARCHAR(191) PRIMARY KEY,kind VARCHAR(32),payload JSON,revision INT,updated_by VARCHAR(32),updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)');
n80_hub_write($root,'control.json',['activeOperations'=>['ai.text'],'paused'=>false]);
n80_hub_write($root.'/codex','connection.json',['state'=>'authenticated','vaultVerified'=>true]);
$id=str_repeat('a',32);$identity=['requestId'=>$id,'runId'=>'12345'];
n80_hub_write($root.'/codex','probe.json',['requestId'=>$id,'mode'=>'single_trial','apiFallback'=>false,'state'=>'prepared','question'=>'N80 역할을 짧게 설명해 주세요.']);
rejected(fn()=>n80_codex_handle($db,'admin',$root,['action'=>'codex.claim','requestId'=>str_repeat('b',32),'runId'=>'12345']),'hub_codex_request_not_authorized');
check((int)$db->query('SELECT COUNT(*) FROM noa_documents')->fetchColumn()===0,'unauthorized request creates no task');
$claim=n80_codex_handle($db,'admin',$root,['action'=>'codex.claim']+$identity);
check($claim['execute']===true,'first claim receives one lease');
check((int)$db->query("SELECT COUNT(*) FROM noa_documents WHERE JSON_UNQUOTE(JSON_EXTRACT(payload,'$.state'))='queued'")->fetchColumn()===0,'legacy provider cannot observe queued trial');
$repeat=n80_codex_handle($db,'admin',$root,['action'=>'codex.claim']+$identity);
check($repeat['execute']===false&&!isset($repeat['lease']),'duplicate claim cannot execute');
$text='N80 Hub가 요청과 결과를 관리합니다.';$finish=['action'=>'codex.complete','lease'=>$claim['lease'],'text'=>$text,'resultSha256'=>hash('sha256',$text),'usage'=>['input_tokens'=>17,'output_tokens'=>9]]+$identity;
rejected(fn()=>n80_codex_handle($db,'admin',$root,array_replace($finish,['lease'=>str_repeat('0',64)])),'hub_codex_lease_invalid');
$done=n80_codex_handle($db,'admin',$root,$finish);check($done['task']['state']==='succeeded'&&$done['task']['result']===$text,'existing SQL task stores actual result');
$replayed=n80_codex_handle($db,'admin',$root,$finish);check($replayed['duplicate']===true&&$replayed['task']['revision']===$done['task']['revision'],'completion replay is read only');
$changed='different';rejected(fn()=>n80_codex_handle($db,'admin',$root,array_replace($finish,['text'=>$changed,'resultSha256'=>hash('sha256',$changed)])),'hub_codex_result_conflict');
$read=n80_codex_handle($db,'admin',$root,['action'=>'codex.read']+$identity);check($read['task']['resultSha256']===hash('sha256',$text)&&$read['task']['usage']['auth']==='chatgpt','independent SQL readback and subscription evidence');
check($read['task']['songSaved']===false,'trial never publishes or edits a song');
echo "N80_CODEX_SQL_TEST_PASSED\n";
