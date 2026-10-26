<?php
declare(strict_types=1);
$root='/tmp/noa-muvy-fixture/html';@mkdir($root,0700,true);@mkdir(dirname($root).'/noa-ai-lab',0700,true);@mkdir($root.'/noa-bridge',0700,true);file_put_contents(dirname($root).'/noa-ai-lab/master.key',random_bytes(32));
$common= <<<'COMMON'
<?php
if(defined('_GNUBOARD_'))return;define('_GNUBOARD_',true);define('G5_PATH',__DIR__);session_start();$role=$_COOKIE['qa_role']??'guest';$is_member=$role!=='guest';$is_admin=$role==='admin'?'super':'';$member=$is_member?['mb_id'=>'qa_'.$role,'mb_level'=>$role==='staff'?10:4]:[];
if(($_SERVER['HTTP_ORIGIN']??'')==='http://127.0.0.1:8077')$_SERVER['HTTP_ORIGIN']='https://noastudio.ai.kr';
require __DIR__.'/provider-fixture.php';
// Native bootstrap noise must not corrupt JSON.
if(str_ends_with($_SERVER['SCRIPT_FILENAME']??'','/muvy.php'))echo "\n<!-- isolated native bootstrap -->\n";
COMMON;
file_put_contents($root.'/common.php',$common);
foreach(['lab-core.php','muvy-core.php','muvy-prompts.php','muvy-rules.php']as $file)copy('bridge/'.$file,$root.'/noa-bridge/'.$file);
$api=str_replace('mu_provider($task)','mu_fixture_provider($task)',file_get_contents('bridge/muvy.php'));file_put_contents($root.'/noa-bridge/muvy.php',$api);
foreach(['noa-ai-lab.php','noa-ai-lab.css','noa-ai-lab.js','noa-muvy-panel.php','noa-muvy.css','noa-muvy.js','noa-ui.css','noa-ui.js','noa-design.json','noa-ui-words.json','noa-brand.js']as $file)copy('deploy/'.$file,$root.'/'.$file);
$provider= <<<'PROVIDER'
<?php
function mu_fixture_provider(array $task):array{
 $path=dirname(G5_PATH).'/provider-calls.json';$calls=is_file($path)?json_decode(file_get_contents($path),true):[];$calls[]=['stage'=>$task['stage'],'batch'=>$task['batch']];file_put_contents($path,json_encode($calls));
 if($task['stage']==='script'){$out=['songType'=>'B','emotionalLine'=>'작은 빛이 다시 이어지는 밤','edition'=>'Moonlight Edition','genre'=>'K-POP','outfits'=>[1=>['woman'=>'white linen dress','man'=>'navy shirt'],2=>['woman'=>'blue silk dress','man'=>'black shirt'],3=>['woman'=>'cream dress','man'=>'white shirt']],'cuts'=>[]];for($i=1;$i<=30;$i++)$out['cuts'][]=['n'=>$i,'lyric'=>'가사 구간 '.$i,'script'=>'NOA가 창가의 빛을 바라본다. 천천히 가까워지는 카메라에 표정이 드러난다. 장면 '.$i];}
 elseif(preg_match('/^c([123])$/',$task['stage'],$m)){$out=['cuts'=>[]];for($i=0;$i<5;$i++){$n=((int)$m[1]-1)*10+$task['batch']*5+$i+1;$out['cuts'][]=['n'=>$n,'gemini'=>'aspect ratio 16:9, horizontal cinematic frame, the same NOA, no text. Cut '.$n,'grok'=>'10 seconds, the same NOA, slow camera movement, no subtitle. Cut '.$n];}}
 elseif(str_starts_with($task['stage'],'extra')){$out=['cuts'=>[['label'=>'보충 1','lyric'=>'','script'=>'노아가 조용히 숨을 고른다. 창밖 빛이 움직인다.','gemini'=>'16:9 the same NOA','grok'=>'10 seconds slow camera'],['label'=>'보충 2','lyric'=>'','script'=>'노엘이 같은 공간을 바라본다. 카메라가 천천히 가까워진다.','gemini'=>'16:9 the same NOEL','grok'=>'10 seconds no subtitle']]];}
 else $out=['youtubeTitle'=>$task['pack']['ep'].' '.$task['pack']['title'].' | K-POP','description'=>'가사의 정서를 따라 빛과 장면을 이어가는 뮤직비디오입니다.','community'=>'새로운 장면으로 이어지는 노아의 이야기.','thumbnailPrompt'=>'16:9 cinematic NOA thumbnail, original title, EP, no watermark'];
 return ['output'=>$out,'usage'=>['prompt_tokens'=>100,'completion_tokens'=>200,'total_tokens'=>300]];
}
PROVIDER;
file_put_contents($root.'/provider-fixture.php',$provider);
$router= <<<'ROUTER'
<?php
$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
if($path==='/noa-bridge/lab-api.php'){require __DIR__.'/common.php';header('Content-Type: application/json');echo '{}';return true;}
if(str_starts_with($path,'/noa-bridge/')&&!is_file(__DIR__.$path)){header('Content-Type: application/json');echo json_encode(['ok'=>true,'items'=>[],'revision'=>0]);return true;}
return false;
ROUTER;
file_put_contents($root.'/router.php',$router);
ob_start();require $root.'/common.php';ob_end_clean();require $root.'/noa-bridge/lab-core.php';require $root.'/noa-bridge/muvy-core.php';
function must(bool $ok,string $why):void{if(!$ok)throw new RuntimeException($why);}
function reject(callable $fn,string $expected):void{try{$fn();}catch(Throwable $e){must($e->getMessage()===$expected,'wrong_error:'.$e->getMessage());return;}throw new RuntimeException('should_reject:'.$expected);}
$member=['mb_id'=>'qa_admin'];$id=str_repeat('a',32);$pack=['ep'=>'EP.12','title'=>'빛이 닿는 순간','lyrics'=>'밤을 따라 걸어가던 작은 마음이 빛을 만나는 순간'];
$p=mu_save(['id'=>$id,'expectedRevision'=>0,'pack'=>$pack])['project'];must($p['revision']===1,'created');must(mu_save(['id'=>$id,'expectedRevision'=>0,'pack'=>$pack])['replayed'],'save_idempotent');reject(fn()=>mu_save(['id'=>$id,'expectedRevision'=>0,'pack'=>array_replace($pack,['title'=>'다른 제목'])]),'revision_conflict');
reject(fn()=>mu_begin(['id'=>$id,'expectedRevision'=>1,'requestId'=>str_repeat('b',32),'stage'=>'script']),'xai_enable_required');
mu_settings(['expectedRevision'=>0,'key'=>'test-xai-key-not-real','model'=>'grok-4.5','dailyCalls'=>20,'enabled'=>true]);must(!str_contains(json_encode(mu_status()),'test-xai-key-not-real'),'key_not_public');must(!str_contains(file_get_contents(lab_root().'/state.json'),'test-xai-key-not-real'),'key_encrypted');
$request=['id'=>$id,'expectedRevision'=>1,'requestId'=>str_repeat('b',32),'stage'=>'script'];$task=mu_begin($request);must(!empty(mu_begin($request)['replayed']),'duplicate_call_reserved_once');must(mu_status()['callsToday']===1,'single_quota_count');reject(fn()=>mu_save(['id'=>$id,'expectedRevision'=>1,'pack'=>$pack]),'generation_in_progress');reject(fn()=>mu_begin(array_replace($request,['requestId'=>str_repeat('c',32)])),'generation_in_progress');
$result=mu_fixture_provider($task);$p=mu_finish($task,$result)['project'];must(count($p['pack']['cuts'])===30,'thirty_cuts');must(mu_begin($request)['replayed'],'finished_call_idempotent');reject(fn()=>mu_apply($p['pack'],'c1',0,['cuts'=>[]]),'provider_cut_count');
$bad=$p['pack'];$bad['cuts'][10]['n']=10;reject(fn()=>mu_pack($bad),'cut_sequence');reject(fn()=>mu_publish(['youtubeTitle'=>'wrong','description'=>'a','community'=>'b','thumbnailPrompt'=>'c'],'EP.12','빛이 닿는 순간'),'publish_title_mismatch');
@mkdir('muvy-proof',0700,true);file_put_contents('muvy-proof/core-regression.json',json_encode(['ok'=>true,'authEnvironment'=>'isolated native interface fixture','provider'=>'deterministic fixture, zero external calls','encryptedKey'=>true,'optimisticRevision'=>true,'idempotentRequests'=>true,'quotaReservedBeforeCall'=>true,'concurrentWritesBlocked'=>true,'thirtyOrderedCuts'=>true,'malformedOutputsRejected'=>true],JSON_PRETTY_PRINT));
// Reset only this disposable fixture; browser tests start from a blank native workroom.
unlink(lab_root().'/muvy.json');unlink(lab_root().'/state.json');unlink(dirname($root).'/provider-calls.json');echo "MUVY_CORE_PRIVATE_STORAGE_AND_IDEMPOTENCY_OK\n";
