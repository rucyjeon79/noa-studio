<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
require_once __DIR__.'/lab-core.php';

function nd_shorts_public(array $c):array {
 if(isset($c['preparation']))unset($c['preparation']['lease'],$c['preparation']['sources'],$c['preparation']['connectionReceipt']);
 if(isset($c['preparation']['subtitlePreparation']))unset($c['preparation']['subtitlePreparation']['lease'],$c['preparation']['subtitlePreparation']['sourceFingerprint']);
 return $c;
}

/** Durable campaign ownership in the existing N80 store; never a conversation timer. */
function nd_shorts_policy():array {
 $path=dirname(__DIR__).'/noa-app/engine/daily-shorts.json';
 $p=json_decode((string)file_get_contents($path),true,32,JSON_THROW_ON_ERROR);
 if(($p['timezone']??'')!=='Asia/Seoul'||($p['publishLocalTime']??'')!=='12:00'||($p['prepareLocalTime']??'')!=='08:00'||($p['maxPerLocalDate']??0)!==1||($p['minSeconds']??0)!==49||($p['maxSeconds']??0)!==59)throw new DomainException('invalid_daily_shorts_policy');
 nd_shorts_weekdays($p);
 return $p;
}
function nd_shorts_weekdays(array $p):array {
 $days=$p['publishIsoWeekdays']??null;
 if(!is_array($days)||!array_is_list($days)||!count($days)||count($days)>7||count(array_unique($days))!==count($days))throw new DomainException('invalid_shorts_weekdays');
 foreach($days as $day)if(!is_int($day)||$day<1||$day>7)throw new DomainException('invalid_shorts_weekdays');
 return $days;
}
/** The tick and all preparation stages use the same timezone-aware calendar. */
function nd_shorts_schedule(array $p,int $now):array {
 $days=nd_shorts_weekdays($p);$zone=new DateTimeZone($p['timezone']);
 $local=(new DateTimeImmutable('@'.$now))->setTimezone($zone);
 [$hour,$minute]=array_map('intval',explode(':',$p['publishLocalTime']));
 $target=$local->setTime($hour,$minute);
 while($target<=$local||!in_array((int)$target->format('N'),$days,true))$target=$target->modify('+1 day');
 [$hour,$minute]=array_map('intval',explode(':',$p['prepareLocalTime']));
 return ['local'=>$local,'target'=>$target,'due'=>$target->setTime($hour,$minute)];
}
function nd_shorts_slot_allowed(array $p,string $publishAt):bool {
 try{$target=new DateTimeImmutable($publishAt);}catch(Exception $e){return false;}
 $target=$target->setTimezone(new DateTimeZone($p['timezone']));
 return in_array((int)$target->format('N'),nd_shorts_weekdays($p),true)&&$target->format('H:i:s')===$p['publishLocalTime'].':00';
}
function nd_shorts_readiness(array $s,array $p):array {
 $channel=$s['channels'][$p['channelId']]??[];$secrets=lab_unseal($s['secrets']??null);
 $youtube=!empty($channel['tokens'])&&!empty($s['config']['oauthClientId'])&&!empty($secrets['oauthClientSecret']);
 // Session browser tools are not a server adapter. Do not infer one from a login or API key.
 $missing=['persistent_browser_executor_required'];
 if(!$youtube)$missing[]='youtube_offline_connection_required';
 elseif(empty($channel['autoEnabled']))$missing[]='youtube_auto_publication_not_enabled';
 return ['ready'=>false,'missing'=>$missing,'youtubeConnected'=>$youtube,'channelAutoEnabled'=>!empty($channel['autoEnabled']),
  'sessionBrowserIsServerExecutor'=>false,'paidGenerationEnabled'=>!empty($s['config']['generationEnabled']),
  'apiGenerationConfigured'=>!empty($secrets['falKey'])&&!empty($secrets['openaiKey']),
  'nativeRelatedVideoAdapterReady'=>false];
}
function nd_shorts_tick(array &$s,array $p,int $now,array $readiness):array {
 ['local'=>$local,'target'=>$target,'due'=>$due]=nd_shorts_schedule($p,$now);$previous=$s['campaigns']['daily_shorts']??[];
 $c=$previous+['enabled'=>true,'createdAt'=>gmdate('c',$now),'current'=>null,'history'=>[]];
 $c['policy']=$p;$c['lastTickAt']=gmdate('c',$now);$c['nextPreparationAt']=$due->format(DATE_ATOM);$c['nextPublicationAt']=$target->format(DATE_ATOM);$c['readiness']=$readiness;
 // Reconcile only an unstarted slot. Never relabel existing media or an upload.
 if($c['current']&&empty($c['current']['jobId'])&&empty($c['current']['videoId'])&&
    !nd_shorts_slot_allowed($p,(string)($c['current']['publishAt']??'')))$c['current']=null;
 if(!$c['enabled']||empty($s['config']['workerEnabled']))$c['state']='paused';
 elseif(empty($readiness['ready'])){$c['state']='connection_required';$c['reason']=implode(',',$readiness['missing']);}
 else{$c['state']=$local<$due?'waiting_schedule':'ready';$c['reason']='';}
 // One durable pending slot, not an empty media job created on every cron tick or day.
 if($c['enabled']&&!empty($s['config']['workerEnabled'])&&$local>=$due){
  if(!$c['current'])$c['current']=['date'=>$target->format('Y-m-d'),'publishAt'=>$target->format(DATE_ATOM),'createdAt'=>gmdate('c',$now),'jobId'=>null,'videoId'=>null,'state'=>$c['state']];
  elseif(empty($c['current']['videoId'])&&empty($c['current']['jobId'])){$c['current']['date']=$target->format('Y-m-d');$c['current']['publishAt']=$target->format(DATE_ATOM);$c['current']['state']=$c['state'];}
 }
 // No adapter exists yet: queued state or timestamps must never masquerade as production.
 $c['productionReady']=!empty($readiness['ready']);$c['schedulerOwner']='N80 Auto';$c['stateOwner']='N80 Engine';$c['conversationDependent']=false;
 $s['campaigns']['daily_shorts']=$c;
 $s['worker']['operations']['n80_daily_shorts_tick']=['state'=>$c['state'],'at'=>$c['lastTickAt'],'missing'=>$readiness['missing']??[]];
 if(($previous['state']??null)!==$c['state'])lab_event($s,'daily_shorts_'.$c['state'],'','n80_auto');
 return ['ok'=>true,'state'=>$c['state'],'campaign'=>nd_shorts_public($c),'processed'=>0,'uploads'=>0];
}
