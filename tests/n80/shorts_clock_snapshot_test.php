<?php
declare(strict_types=1);
/** Execute the real worker, schedule/readiness and Lab read code on synthetic data. */
$base=sys_get_temp_dir().'/n80-snapshot-'.bin2hex(random_bytes(8));
mkdir($base,0700);mkdir($base.'/www',0700);mkdir($base.'/www/noa-bridge',0700);
mkdir($base.'/www/noa-app',0700);mkdir($base.'/www/noa-app/engine',0700);mkdir($base.'/noa-ai-lab',0700);
$files=['worker-shorts.php','lab-core.php','session-shorts.php','session-shorts-prepare.php','muvy-timeline.php'];
foreach($files as $f)copy(__DIR__.'/../../bridge/'.$f,$base.'/www/noa-bridge/'.$f);
copy(__DIR__.'/../../config/n80-daily-shorts.json',$base.'/www/noa-app/engine/daily-shorts.json');
$initial=['revision'=>17,'jobs'=>['existing'=>['state'=>'cancelled','outputs'=>[]]],
 'channels'=>[],'config'=>['workerEnabled'=>true],'events'=>[['preserve'=>'old_event']],
 'campaigns'=>['daily_shorts'=>['enabled'=>true,'current'=>null,'history'=>[['preserve'=>'old_slot']]]]];
$raw=json_encode($initial,JSON_THROW_ON_ERROR);file_put_contents($base.'/noa-ai-lab/state.json',$raw);touch($base.'/noa-ai-lab/state.lock');
register_shutdown_function(static function()use($base,$files):void {
 foreach($files as $f)unlink($base.'/www/noa-bridge/'.$f);
 unlink($base.'/www/noa-app/engine/daily-shorts.json');unlink($base.'/noa-ai-lab/state.json');unlink($base.'/noa-ai-lab/state.lock');
 foreach(['/www/noa-app/engine','/www/noa-app','/www/noa-bridge','/www','/noa-ai-lab',''] as $d)rmdir($base.$d);
});
define('_GNUBOARD_',true);define('G5_PATH',$base.'/www');
$context=['hostOperation'=>'ai.daily_shorts_clock','readOnlyClockCheck'=>true];$action='n80_daily_shorts_tick';$b=[];
$r=require $base.'/www/noa-bridge/worker-shorts.php';
if($r['readOnlyCheck']['sourceRevision']!==17||$r['readOnlyCheck']['businessStateWritten']!==false
 ||$r['readOnlyCheck']['providerCalls']!==0||$r['state']!=='connection_required'||$r['uploads']!==0||$r['processed']!==0
 ||!isset($r['campaign']['nextPreparationAt']))throw new RuntimeException('real_module_snapshot_failed');
if(file_get_contents($base.'/noa-ai-lab/state.json')!==$raw)throw new RuntimeException('original_state_changed');
$b=['command'=>'storage_claim'];$denied=false;
try{require $base.'/www/noa-bridge/worker-shorts.php';}catch(DomainException $e){$denied=$e->getMessage()==='clock_check_scope_invalid';}
if(!$denied)throw new RuntimeException('command_injection_not_denied');
if(file_get_contents($base.'/noa-ai-lab/state.json')!==$raw)throw new RuntimeException('rejected_call_wrote_state');
echo "N80_SHORTS_SNAPSHOT_PASS real module computed, original state byte-identical, provider calls zero\n";
