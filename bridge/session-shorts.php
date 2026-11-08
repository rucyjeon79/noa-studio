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
 return $p;
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
 $zone=new DateTimeZone($p['timezone']);$local=(new DateTimeImmutable('@'.$now))->setTimezone($zone);
 $target=$local->setTime(12,0);if($local>=$target)$target=$target->modify('+1 day');
 $due=$target->setTime(8,0);$previous=$s['campaigns']['daily_shorts']??[];
 $c=$previous+['enabled'=>true,'createdAt'=>gmdate('c',$now),'current'=>null,'history'=>[]];
 $c['policy']=$p;$c['lastTickAt']=gmdate('c',$now);$c['nextPreparationAt']=$due->format(DATE_ATOM);$c['nextPublicationAt']=$target->format(DATE_ATOM);$c['readiness']=$readiness;
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
