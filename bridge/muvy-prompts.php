<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
require_once __DIR__.'/muvy-timeline.php';
function mu_text(mixed $v,int $max,bool $empty=false):string{if(!is_string($v)||!mb_check_encoding($v,'UTF-8')||str_contains($v,"\0"))throw new InvalidArgumentException('invalid_pack');$v=trim($v);if((!$empty&&$v==='')||mb_strlen($v)>$max)throw new InvalidArgumentException('invalid_pack');return $v;}
function mu_meta(array $m):array{if(!in_array($m['songType']??'', ['A','B','C','mixed'],true))throw new InvalidArgumentException('invalid_pack');$r=['songType'=>$m['songType']];foreach(['emotionalLine','edition','genre']as $k)$r[$k]=mu_text($m[$k]??null,600);foreach([1,2,3]as $c)foreach(['woman','man']as $sex)$r['outfits'][$c][$sex]=mu_text($m['outfits'][$c][$sex]??null,1000);return $r;}
function mu_cut(array $c,int $n,bool $extra=false):array{if(!$extra&&($c['n']??0)!==$n)throw new InvalidArgumentException('cut_sequence');$r=['n'=>$n,'lyric'=>mu_text($c['lyric']??'',600,true),'script'=>mu_text($c['script']??null,1800),'gemini'=>mu_text($c['gemini']??'',6000,true),'grok'=>mu_text($c['grok']??'',6000,true)];if($extra)$r['label']=mu_text($c['label']??'보충 '.$n,80);return $r;}
function mu_pack(array $p):array{
 $r=['ep'=>mu_text($p['ep']??null,40,isset($p['song'])),'title'=>mu_text($p['title']??null,120),'lyrics'=>mu_text($p['lyrics']??null,12000),'meta'=>null,'cuts'=>[],'extras'=>[1=>[],2=>[],3=>[]],'publish'=>null];
 if(isset($p['timing'])){$t=mu_timeline($p['timing']);$r['timing']=array_diff_key($t,['scenes'=>true,'cutCount'=>true,'version'=>true]);}
 if(isset($p['song'])){
  $song=$p['song'];
  if(!is_array($song)||!is_string($song['key']??null)||!preg_match('/^[A-Za-z0-9:_-]{1,190}$/D',$song['key']))throw new InvalidArgumentException('invalid_pack');
  $r['song']=['key'=>$song['key']];
  foreach(['documentKey','audioSha256'] as $field)if(isset($song[$field]))$r['song'][$field]=mu_text($song[$field],191,true);
  if(isset($song['revision']))$r['song']['revision']=(int)$song['revision'];
  foreach(['genre'=>191,'vocal'=>1200,'cast'=>1200,'description'=>3000] as $field=>$limit)$r['song'][$field]=mu_text($song[$field]??'', $limit, true);
 }
 if(mb_strlen($r['lyrics'])<10)throw new InvalidArgumentException('lyrics_too_short');
 if(!empty($p['cuts'])){if(!is_array($p['cuts'])||!array_is_list($p['cuts'])||count($p['cuts'])>3600||(isset($r['timing'])&&count($p['cuts'])>mu_expected_cuts($r)))throw new InvalidArgumentException('scene_count_mismatch');$r['meta']=mu_meta($p['meta']??[]);foreach($p['cuts']as $i=>$c)$r['cuts'][]=mu_cut($c,$i+1);foreach([1,2,3]as $ch){$extra=$p['extras'][$ch]??[];if(!is_array($extra)||count($extra)>8)throw new InvalidArgumentException('extra_limit');foreach(array_values($extra)as $i=>$c)$r['extras'][$ch][]=mu_cut($c,$i+1,true);}if(!empty($p['publish']))$r['publish']=mu_publish($p['publish'],$r['ep'],$r['title']);}
 return $r;
}
function mu_publish(array $p,string $ep,string $title):array{$r=[];foreach(['youtubeTitle'=>100,'description'=>6000,'community'=>2000,'thumbnailPrompt'=>6000]as $k=>$max)$r[$k]=mu_text($p[$k]??null,$max);if(!str_contains($r['youtubeTitle'],$title)||!str_contains($r['youtubeTitle'],$ep))throw new InvalidArgumentException('publish_title_mismatch');return $r;}
function mu_prompt(array $p,string $stage,int $batch,string $note,bool $legacy=false):array{
 $rules=require __DIR__.'/muvy-rules.php';$intro=($p['ep']===''?'EP 번호 없음. EP를 만들거나 표기하지 마라.':"EP: {$p['ep']}")."\n제목: {$p['title']}\n";
 if(isset($p['song'])){
  $context=array_filter(array_intersect_key($p['song'],array_flip(['genre','vocal','cast','description'])),static fn($v)=>$v!=='');
  $intro.='선택한 버전의 저장된 곡정보: '.json_encode($context,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)."\n제목·장르·보컬과 가사에 맞춰 제작하라.\n";
 }
 if($stage==='script'){
  if(empty($p['timing'])){if(!$legacy)throw new DomainException('audio_duration_required');return [$rules,$intro.'이전 버전에서 이미 접수한 30장면 대본 작업만 완료한다. 가사: '.$p['lyrics'].' JSON: {"songType":"B","emotionalLine":"한국어","edition":"영화","genre":"POP","outfits":{"1":{"woman":"coat","man":"shirt"},"2":{"woman":"coat","man":"shirt"},"3":{"woman":"coat","man":"shirt"}},"cuts":[{"n":1,"lyric":"가사","script":"장면"}]} 1~30번 순서 그대로.',9000];}
  $plan=mu_timeline($p['timing']);$start=$batch*10;$length=min(10,$plan['cutCount']-$start);
  if($batch<0||$start!==count($p['cuts'])||$length<1)throw new DomainException('script_batch_changed');
  $existing=$p['meta']?'이미 확정된 설정을 그대로 유지: '.json_encode($p['meta'],JSON_UNESCAPED_UNICODE):'인물·의상을 곡에 맞춰 정하라.';
  $context=$intro."가사:\n{$p['lyrics']}\n".$existing.' 전체 '.$plan['durationSeconds'].'초, 총 '.$plan['cutCount'].'컷. 이번에는 CUT '.($start+1).'부터 '.($start+$length).'까지만 생성하라. 시간표: '.json_encode(array_slice($plan['scenes'],$start,$length),JSON_UNESCAPED_UNICODE).' 앞선 장면: '.json_encode(array_slice($p['cuts'],-2),JSON_UNESCAPED_UNICODE);
  return [$rules,$context.' Gemini·영상 프롬프트는 아직 쓰지 마라. JSON: {"songType":"A|B|C|mixed","emotionalLine":"한국어 감성 한줄","edition":"에디션","genre":"장르","outfits":{"1":{"woman":"영어 의상","man":"영어 의상"},"2":{"woman":"영어 의상","man":"영어 의상"},"3":{"woman":"영어 의상","man":"영어 의상"}},"cuts":[{"n":1,"lyric":"가사 구간","script":"한국어 장면·감정·장소·카메라"}]} 이번 범위 번호만 순서대로 정확히 '.$length.'개. 음악 도입·간주·마무리도 전체 시간 안에 배치하라.',6500];
 }
 if(!mu_expected_cuts($p)||count($p['cuts'])!==mu_expected_cuts($p))throw new DomainException('script_required');
 if(preg_match('/^(c|extra)([123])$/D',$stage,$m)){
  $ch=(int)$m[2];$seconds=$p['timing']['clipSeconds']??8;$context=$intro.'곡 정보: '.json_encode($p['meta'],JSON_UNESCAPED_UNICODE)."\n챕터 $ch. 각 영상은 $seconds seconds, 한 장면의 연속 숏. 편집 전환은 후처리하므로 영상에 페이드를 굽지 마라. 의상은 outfits를 유지. ";$cuts=mu_chapter_cuts($p,$ch);
  if($m[1]==='c'){$cuts=mu_chapter_cuts($p,$ch,$batch);$n=count($cuts);return [$rules,$context.'잠긴 대본을 바꾸지 말고 다음 '.$n.'컷의 이미지·영상 프롬프트만 작성: '.json_encode(array_map(fn($c)=>array_intersect_key($c,array_flip(['n','lyric','script'])),$cuts),JSON_UNESCAPED_UNICODE).' JSON: {"cuts":[{"n":1,"gemini":"영어 이미지 프롬프트","video":"영어 Flow 영상 프롬프트"}]} 입력 번호와 순서 그대로 정확히 '.$n.'개.',6500];}
  if(count($p['extras'][$ch])>=8)throw new DomainException('extra_limit');return [$rules,$context.'기존 컷과 전체 길이를 바꾸지 않고 교체 후보인 보충컷 2개만 작성. 요청: '.$note.' 기존 장면: '.json_encode(['cuts'=>$cuts,'extras'=>$p['extras'][$ch]],JSON_UNESCAPED_UNICODE).' JSON: {"cuts":[{"label":"보충 1","lyric":"","script":"한국어 장면","gemini":"영어 이미지 프롬프트","video":"영어 Flow 영상 프롬프트"}]} 정확히 2개.',5500];
 }
 if($stage==='publish')return [$rules."\n공개 패키지: 유튜브 제목은 100자 이내이며 원래 제목과 장르를 포함. EP 번호는 있는 경우만 표기. 설명란 한국어 600~1100자, 첫 줄에 제목·EP. 커뮤니티 한국어 200~400자. 광고·가짜 아티스트·구독 강요 금지. 썸네일은 상징적인 장면 하나의 영어 프롬프트. NOA·NOEL의 얼굴 고정. 16:9. 텍스트는 좌상단 EP, 중앙 큰 원제목, 아래 에디션 | 장르, 아래 감성 한줄 원문. 얼굴과 글자 겹침 금지. 로고·워터마크 금지.",$intro.'곡 정보: '.json_encode($p['meta'],JSON_UNESCAPED_UNICODE).' 후반 대본: '.json_encode(mu_chapter_cuts($p,3),JSON_UNESCAPED_UNICODE).' JSON: {"youtubeTitle":"","description":"","community":"","thumbnailPrompt":""}',5000];
 throw new InvalidArgumentException('invalid_stage');
}
function mu_apply(array $p,string $stage,int $batch,array $out,bool $legacy=false):array{
 if($stage==='script'){
  if(empty($p['timing'])){if(!$legacy)throw new DomainException('audio_duration_required');if(count($out['cuts']??[])!==30)throw new InvalidArgumentException('provider_cut_count');$p['meta']=mu_meta($out);$p['cuts']=$out['cuts'];return mu_pack($p);}
  $start=$batch*10;$length=min(10,mu_expected_cuts($p)-$start);$rows=$out['cuts']??null;
  if($start!==count($p['cuts'])||$length<1)throw new DomainException('script_batch_changed');
  if(!is_array($rows)||!array_is_list($rows)||count($rows)!==$length)throw new InvalidArgumentException('provider_cut_count');
  if(!$p['meta'])$p['meta']=mu_meta($out);
  foreach($rows as $i=>$c)$p['cuts'][]=mu_cut($c,$start+$i+1);
  $p['publish']=null;return mu_pack($p);
 }
 if(preg_match('/^(c|extra)([123])$/D',$stage,$m)){
  $ch=(int)$m[2];$expected=$m[1]==='c'?mu_chapter_cuts($p,$ch,$batch):null;$rows=$out['cuts']??[];
  if(!is_array($rows)||!array_is_list($rows)||count($rows)!==($expected===null?2:count($expected)))throw new InvalidArgumentException('provider_cut_count');
  if($expected!==null){foreach($rows as $i=>$c){$n=$expected[$i]['n'];if(($c['n']??null)!==$n)throw new InvalidArgumentException('cut_sequence');$p['cuts'][$n-1]['gemini']=mu_text($c['gemini']??null,6000);$p['cuts'][$n-1]['grok']=mu_text($c['video']??$c['grok']??null,6000);}}
  else{foreach($rows as $c){$c['grok']=$c['video']??$c['grok']??'';$r=mu_cut($c,count($p['extras'][$ch])+1,true);if(!$r['gemini']||!$r['grok'])throw new InvalidArgumentException('invalid_pack');$p['extras'][$ch][]=$r;}}
  return mu_pack($p);
 }
 if($stage==='publish'){$p['publish']=mu_publish($out,$p['ep'],$p['title']);return mu_pack($p);}
 throw new InvalidArgumentException('invalid_stage');
}
