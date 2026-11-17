<?php
declare(strict_types=1);
if(!isset($context,$action)||$action!=='n80_daily_shorts_tick')throw new RuntimeException('n80_dispatch_required');
require_once __DIR__.'/session-shorts.php';
require_once __DIR__.'/session-shorts-prepare.php';
$policy=nd_shorts_policy();
if(($b['command']??'')==='storage_connection'){
 if(($policy['mediaStorage']['provider']??'')==='github_actions_artifact')return ['ok'=>true,'provider'=>'github_actions_artifact','connected'=>false,'state'=>'github_runtime_check_required'];
 require_once __DIR__.'/session-shorts-drive.php';return nsd_status(lab_read(),$policy,(string)($context['admin']??''));
}
if(in_array($b['command']??'',['storage_claim','storage_reserve','storage_read','storage_complete','storage_fail','storage_credentials'],true)){
 require_once __DIR__.'/session-shorts-storage.php';return nd_storage_dispatch($b,(string)($context['admin']??''));
}
if(in_array($b['command']??'',['assembly_attach','assembly_claim','assembly_read','assembly_write','assembly_fail'],true)){
 require_once __DIR__.'/session-shorts-assemble.php';return nd_assembly_dispatch($b,(string)($context['admin']??''));
}
if(in_array($b['command']??'',['claim_subtitles','complete_subtitles','fail_subtitles'],true)){
 require_once __DIR__.'/session-shorts-subtitles.php';return nd_caption_dispatch($b);
}
if(($b['command']??'')!=='')return nd_prepare_dispatch($b,$policy);
return lab_lock(function(&$s)use($policy,$context){
 // Recheck ownership after acquiring the existing store lock: a legacy request
 // may have passed the outer dispatcher just before the host migration.
 require_once dirname(__DIR__).'/noa-app/engine/hub.php';
 if(($context['hostOperation']??null)!=='ai.daily_shorts_clock'&&n80_hub_owner('ai.daily_shorts_clock')==='n80_hub')
  return ['ok'=>true,'state'=>'host_owned','processed'=>0,'uploads'=>0];
 return nd_shorts_tick($s,$policy,time(),nd_shorts_readiness($s,$policy));
},defined('N80_SCHEDULED_CLOCK_ONCE')&&N80_SCHEDULED_CLOCK_ONCE===true?750:null);
