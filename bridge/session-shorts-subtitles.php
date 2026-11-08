<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
require_once __DIR__.'/session-agent.php';

/** Actual recognition is a bounded stage of the same N80 campaign/worker. */
function nd_caption_identity(array $source):string {
 return hash('sha256',json_encode([$source['key'],$source['revision'],$source['audioSha256'],hash('sha256',$source['lyrics'])],JSON_THROW_ON_ERROR));
}
function nd_caption_claim(array &$s,int $now,callable $readSource):array {
 $c=&$s['campaigns']['daily_shorts'];$p=$c['preparation']??[];
 if(empty($c['enabled'])||empty($s['config']['workerEnabled']))return ['ok'=>true,'claimed'=>false,'state'=>'paused'];
 if(($p['state']??'')!=='analyzed')return ['ok'=>true,'claimed'=>false,'state'=>'analysis_required'];
 if(strtotime($p['publishAt']??'')<=$now)return ['ok'=>true,'claimed'=>false,'state'=>'preparation_date_expired'];
 $a=$p['subtitlePreparation']??[];
 if(($a['leaseUntil']??0)>$now)return ['ok'=>true,'claimed'=>false,'state'=>'recognizing'];
 $r=$p['report']['candidates'][0]??null;
 if(!$r)throw new DomainException('analyzed_candidate_required');
 $source=$readSource($r['trackKey']);
 if($source['revision']!==$r['sourceRevision']||$source['audioSha256']!==$r['audioSha256'])return ['ok'=>true,'claimed'=>false,'state'=>'source_changed_replan_required'];
 $fingerprint=nd_caption_identity($source);$same=($a['sourceFingerprint']??'')===$fingerprint&&($a['protocolVersion']??0)===1;
 if($same&&in_array($a['state']??'',['aligned','needs_review','translation_required'],true))return ['ok'=>true,'claimed'=>false,'state'=>$a['state']];
 if($same&&($a['attempts']??0)>=3)return ['ok'=>true,'claimed'=>false,'state'=>'subtitle_retry_limit'];
 $a=['protocolVersion'=>1,'trackKey'=>$source['key'],'sourceRevision'=>$source['revision'],'sourceFingerprint'=>$fingerprint,
  'videoId'=>$r['videoId'],'state'=>'recognizing','attempts'=>$same?$a['attempts']+1:1,'startedAt'=>gmdate('c',$now),
  'lease'=>bin2hex(random_bytes(24)),'leaseUntil'=>$now+1200,'audioListeningReviewed'=>false,'publicationReady'=>false];
 if(!preg_match('/[가-힣]/u',implode('',sa_lyric_lines($source['lyrics'])))){
  $a['state']='translation_required';$a['lease']='';$a['leaseUntil']=0;
  $c['preparation']['subtitlePreparation']=$a;
  return ['ok'=>true,'claimed'=>false,'state'=>'translation_required'];
 }
 $c['preparation']['subtitlePreparation']=$a;
 return ['ok'=>true,'claimed'=>true,'lease'=>$a['lease'],'source'=>$source];
}
function nd_caption_authorize(array $s,array $b,int $now):array {
 $c=$s['campaigns']['daily_shorts']??[];$a=$c['preparation']['subtitlePreparation']??[];
 if(empty($c['enabled'])||empty($s['config']['workerEnabled']))throw new DomainException('daily_shorts_paused');
 if(($c['preparation']['state']??'')!=='analyzed'||($a['state']??'')!=='recognizing'||($a['leaseUntil']??0)<=$now
  ||!is_string($b['lease']??null)||!hash_equals($a['lease']??'',$b['lease']))throw new DomainException('subtitle_lease_expired');
 return $a;
}
function nd_caption_complete(array &$s,array $b,int $now,callable $readSource):array {
 $a=nd_caption_authorize($s,$b,$now);$source=$readSource($a['trackKey']);
 if(nd_caption_identity($source)!==$a['sourceFingerprint'])throw new DomainException('source_changed_replan_required');
 // Reuse the existing exact-lyric, source-hash and measured-timing validator.
 $j=['audioSha256'=>$source['audioSha256'],'source'=>$source,'agent'=>['active'=>null]];
 sa_subtitle_save($j,['subtitles'=>$b['subtitles']??null]);$subtitle=$j['agent']['subtitles'];
 $a['state']=$subtitle['status']==='ready'?'aligned':'needs_review';$a['subtitles']=$subtitle;
 $a['nonKoreanLines']=[];
 foreach(sa_lyric_lines($source['lyrics']) as $i=>$line)if(!preg_match('/[가-힣]/u',$line)&&preg_match('/[a-z]{2}/i',$line))$a['nonKoreanLines'][]=$i+1;
 $a['finishedAt']=gmdate('c',$now);$a['lease']='';$a['leaseUntil']=0;
 $s['campaigns']['daily_shorts']['preparation']['subtitlePreparation']=$a;
 return ['ok'=>true,'state'=>$a['state'],'cueCount'=>count($subtitle['cues']),'issueCount'=>count($subtitle['issues']),
  'nonKoreanLineCount'=>count($a['nonKoreanLines']),'audioListeningReviewed'=>false,'publicationReady'=>false];
}
function nd_caption_dispatch(array $b):array {
 $command=$b['command']??'';
 if($command==='claim_subtitles')return lab_lock(fn(&$s)=>nd_caption_claim($s,time(),'sa_source'));
 if($command==='complete_subtitles')return lab_lock(fn(&$s)=>nd_caption_complete($s,$b,time(),'sa_source'));
 if($command==='fail_subtitles')return lab_lock(function(&$s)use($b){
  $a=nd_caption_authorize($s,$b,time());$a['state']='subtitle_failed';
  $a['reason']=preg_match('/^[a-z_]{1,100}$/D',(string)($b['reason']??''))?$b['reason']:'subtitle_dependency_failed';
  $a['lease']='';$a['leaseUntil']=0;$a['finishedAt']=gmdate('c');
  $s['campaigns']['daily_shorts']['preparation']['subtitlePreparation']=$a;
  return ['ok'=>true,'state'=>$a['state'],'reason'=>$a['reason']];
 });
 throw new InvalidArgumentException('unknown_subtitle_command');
}
