<?php
declare(strict_types=1);
if(!isset($context,$action)||$action!=='n80_daily_shorts_tick')throw new RuntimeException('n80_dispatch_required');
require_once __DIR__.'/session-shorts.php';
require_once __DIR__.'/session-shorts-prepare.php';
$policy=nd_shorts_policy();$ready=nd_shorts_readiness(lab_read(),$policy);
if(in_array($b['command']??'',['assembly_attach','assembly_claim','assembly_read','assembly_write','assembly_fail'],true)){
 require_once __DIR__.'/session-shorts-assemble.php';return nd_assembly_dispatch($b,(string)($context['admin']??''));
}
if(in_array($b['command']??'',['claim_subtitles','complete_subtitles','fail_subtitles'],true)){
 require_once __DIR__.'/session-shorts-subtitles.php';return nd_caption_dispatch($b);
}
if(($b['command']??'')!=='')return nd_prepare_dispatch($b,$policy);
return lab_lock(fn(&$s)=>nd_shorts_tick($s,$policy,time(),$ready));
