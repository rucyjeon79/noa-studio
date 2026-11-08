<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}

/** Subtitle state belongs to the existing leased N80 session task. */
function sa_lyric_lines(string $lyrics):array {
 $lines=[];foreach(preg_split('/\R/u',$lyrics) as $raw){$line=trim(preg_replace('/\s+/u',' ',preg_replace('/\[[^\]]*\]/u','',$raw)));if($line!=='')$lines[]=$line;}
 return $lines;
}
function sa_subtitle_digest(array $j,array $cues):string {
 $data=$j['audioSha256']."\n".hash('sha256',$j['source']['lyrics'])."\n";
 foreach($cues as $c)$data.=$c['line'].':'.$c['startMs'].':'.$c['endMs'].':'.$c['text']."\n";
 return hash('sha256',$data);
}
function sa_subtitle_summary(array $j):array {
 $s=$j['agent']['subtitles']??['enabled'=>false];
 return ['enabled'=>!empty($s['enabled']),'status'=>$s['status']??'off','count'=>count($s['cues']??[]),'issues'=>$s['issues']??[],'sha256'=>$s['sha256']??null];
}
function sa_subtitle_save(array &$j,array $b):void {
 $a=&$j['agent'];if($a['active'])throw new DomainException('subtitle_operation_in_progress');
 $s=$b['subtitles']??null;$lines=sa_lyric_lines($j['source']['lyrics']);
 if(!$lines||count($lines)>500||mb_strlen(implode('',$lines))>20000||!preg_match('/[가-힣]/u',implode('',$lines)))throw new DomainException('korean_lyrics_required');
 if(!is_array($s)||($s['sourceAudioSha256']??'')!==$j['audioSha256']||($s['lyricsSha256']??'')!==hash('sha256',$j['source']['lyrics']))throw new DomainException('subtitle_source_mismatch');
 if(!in_array($s['method']??'',['faster-whisper','timestamped-asr'],true)||!is_string($s['model']??null)||strlen($s['model'])>80)throw new InvalidArgumentException('subtitle_evidence_required');
 $rows=$s['cues']??null;if(!is_array($rows)||!array_is_list($rows)||count($rows)>count($lines))throw new InvalidArgumentException('invalid_subtitle_cues');
 $cues=[];$issues=[];$last=0;$previousLine=0;$end=(int)round($j['source']['duration']*1000);
 foreach($rows as $row){
  if(!is_array($row))throw new InvalidArgumentException('invalid_subtitle_cues');
  $n=$row['line']??null;$start=$row['startMs']??null;$stop=$row['endMs']??null;$match=$row['match']??null;$prob=$row['probability']??null;$gap=$row['maxWordGapMs']??null;
  if(!is_int($n)||$n<=$previousLine||!isset($lines[$n-1])||!is_int($start)||!is_int($stop)||$start<$last||$stop<=$start||$stop>$end
   ||!is_numeric($match)||!is_numeric($prob)||!is_finite((float)$match)||!is_finite((float)$prob)||$match<0||$match>1||$prob<0||$prob>1||!is_int($gap)||$gap<0||$gap>$stop-$start
   ||($row['text']??null)!==$lines[$n-1]||mb_strlen($lines[$n-1])>240||preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f]/',$lines[$n-1]))throw new InvalidArgumentException('invalid_subtitle_cues');
  $cues[]=['line'=>$n,'startMs'=>$start,'endMs'=>$stop,'text'=>$lines[$n-1],'match'=>(float)$match,'probability'=>(float)$prob,'maxWordGapMs'=>$gap];
  if($match<.85||$prob<.55||$stop-$start>15000||$gap>1800)$issues[]=['line'=>$n,'reason'=>'timing_needs_review'];
  $previousLine=$n;$last=$stop;
 }
 $present=array_column($cues,'line');foreach($lines as $i=>$line)if(!in_array($i+1,$present,true))$issues[]=['line'=>$i+1,'reason'=>'voice_not_matched'];
 $a['subtitles']=['enabled'=>true,'status'=>$issues?'needs_review':'ready','cues'=>$cues,'issues'=>$issues,'sha256'=>sa_subtitle_digest($j,$cues),
  'sourceAudioSha256'=>$j['audioSha256'],'lyricsSha256'=>hash('sha256',$j['source']['lyrics']),'method'=>$s['method'],'model'=>$s['model'],'updatedAt'=>gmdate('c')];
 $j['state']='agent_ready';
}
function sa_subtitle_review(array &$j,array $b):void {
 $a=&$j['agent'];$s=&$a['subtitles'];
 if($a['active']||empty($s['enabled'])||!isset($s['cues'])||count($s['cues'])!==count(sa_lyric_lines($j['source']['lyrics'])))throw new DomainException('complete_subtitles_required');
 if(($b['audioChecked']??false)!==true||($b['accepted']??false)!==true)throw new DomainException('subtitle_audio_review_required');
 $s['review']=sa_string($b['note']??null,1500);$s['status']='ready';$s['reviewedAt']=gmdate('c');$s['issues']=[];
}
function sa_subtitle_text(array $j,string $format):string {
 $s=$j['agent']['subtitles']??[];if(empty($s['enabled'])||($s['status']??'')!=='ready')throw new DomainException('subtitles_not_ready');
 if(!in_array($format,['srt','vtt'],true))throw new InvalidArgumentException('invalid_subtitle_format');
 $stamp=static function(int $ms)use($format):string{return sprintf('%02d:%02d:%02d%s%03d',intdiv($ms,3600000),intdiv($ms,60000)%60,intdiv($ms,1000)%60,$format==='srt'?',':'.',$ms%1000);};
 $out=$format==='vtt'?"WEBVTT\n\n":'';
 $cues=$s['cues'];$selection=$j['agent']['selection']??null;
 if($selection){$start=(int)round($selection['start']*1000);$end=(int)round($selection['end']*1000);$cues=array_values(array_filter($cues,fn($c)=>$c['endMs']>$start&&$c['startMs']<$end));foreach($cues as &$cue){$cue['startMs']=max($start,$cue['startMs'])-$start;$cue['endMs']=min($end,$cue['endMs'])-$start;}unset($cue);}
 foreach($cues as $i=>$c){$text=strtr($c['text'],['&'=>'&amp;','<'=>'&lt;','>'=>'&gt;']);$out.=($i+1)."\n".$stamp($c['startMs']).' --> '.$stamp($c['endMs'])."\n".$text."\n\n";}
 return $out;
}
