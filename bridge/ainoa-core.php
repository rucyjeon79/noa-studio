<?php
declare(strict_types=1);
/** Public projection is deliberately separate from administrator production records. */
function na_public(array $d):bool{return !in_array($d['visibility']??$d['publicStatus']??'public',['private','draft','unlisted','hidden'],true)&&(empty($d['ownerId'])||($d['visibility']??'')==='public');}
function na_summary(array $r,bool $allowPrivate=false):?array{
 $d=json_decode($r['payload'],true,512,JSON_THROW_ON_ERROR);if(!na_public($d)&&!$allowPrivate)return null;$b=$d['body']??[];
 return ['key'=>$r['doc_key'],'title'=>(string)($b['confirmedTitle']??$d['title']??''),'genre'=>(string)($d['genreId']??''),'ep'=>(string)($d['ep']??''),'lyrics'=>noa_sound_lyrics((string)($b['lyricsBlock']??'')),'description'=>(($d['mediaAvailability']['status']??'')==='public'?(string)($b['youtubeDescription']??$b['songDescription']??$b['descriptionBlock']??''):'')];
}
function na_text(string $system,array $context,int $tokens=2200):string{
 require_once __DIR__.'/lab-core.php';
 // Shared daily budget with AI LAB. Reserve before calling; failures keep their reservation.
 $secret=lab_lock(function(&$s){$secret=lab_unseal($s['secrets']??null);if(empty($s['config']['textEnabled'])||empty($secret['openaiKey']))throw new DomainException('ai_not_configured');$today=gmdate('Y-m-d');$sum=0.0;foreach($s['jobs'] as $j)if(substr($j['costReservedAt']??'',0,10)===$today)$sum+=(float)($j['costReservedUsd']??0);$s['ainoaUsage']=array_filter($s['ainoaUsage']??[],fn($k)=>$k===$today,ARRAY_FILTER_USE_KEY);$used=(float)($s['ainoaUsage'][$today]??0);if(($s['config']['maxJobUsd']??0)<.1||$sum+$used+.1>($s['config']['dailyBudgetUsd']??0))throw new DomainException('ai_budget_exceeded');$s['ainoaUsage'][$today]=$used+.1;return $secret['openaiKey'];});
 $body=json_encode(['model'=>'gpt-4.1-mini','messages'=>[['role'=>'system','content'=>$system],['role'=>'user','content'=>json_encode($context,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]],'max_completion_tokens'=>$tokens,'store'=>false],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
 $r=lab_https('https://api.openai.com/v1/chat/completions',[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>$body,CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Bearer '.$secret]]);
 if(($r['choices'][0]['finish_reason']??'')!=='stop')throw new RuntimeException('incomplete_ai_result');$text=$r['choices'][0]['message']['content']??'';if(!is_string($text)||trim($text)===''||mb_strlen($text)>20000)throw new RuntimeException('empty_ai_result');return trim($text);
}
/** Search only listener text; neighbouring production cues never become result snippets. */
function na_search_hit(array $song,string $query):?array{
 $title=mb_stripos($song['title'],$query)!==false;$line='';
 foreach(preg_split('/\R/u',$song['lyrics'])as $candidate){$candidate=trim($candidate);if($candidate===''||mb_stripos($candidate,$query)===false)continue;
  if(preg_match('/^\[[^\]\r\n]*\]$/u',$candidate))continue;
  if(preg_match('/^\([^\r\n]*\)$/u',$candidate)&&preg_match('/\b(?:vocal|piano|synth|reverb|fade|gayageum|ajaeng|sogeum|kkwaenggwari|percussion|arpeggio|glissando|bass|groove|pad|guitar|drums?|instrumental|harmony)\b/i',$candidate))continue;
  $at=mb_stripos($candidate,$query);$line=mb_substr($candidate,max(0,$at-35),160);break;
 }
 if(!$title&&$line==='')return null;
 return ['score'=>mb_strtolower(trim($song['title']))===mb_strtolower($query)?0:($title?1:2),'snippet'=>$line];
}

/** Registered public description only; playback never calls the AI provider or debits points. */
function na_guide(array $song):string{
 $description=trim(preg_replace('/\s+/u',' ',strip_tags((string)($song['description']??''))));
 $description=trim(preg_replace('~https?://\S+|#[^\s]+~u','',$description));
 if($description!=='')return mb_substr($description,0,140).(mb_strlen($description)>140?'…':'');
 return '지금 듣는 곡은 “'.mb_substr((string)$song['title'],0,80).'”이에요. 편안히 감상해 주세요.';
}
