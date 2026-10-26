<?php
declare(strict_types=1);
/** Public projection is deliberately separate from administrator production records. */
function na_public(array $d):bool{return !in_array($d['visibility']??$d['publicStatus']??'public',['private','draft','unlisted','hidden'],true)&&(empty($d['ownerId'])||($d['visibility']??'')==='public');}
function na_summary(array $r,bool $allowPrivate=false):?array{
 $d=json_decode($r['payload'],true,512,JSON_THROW_ON_ERROR);if(!na_public($d)&&!$allowPrivate)return null;$b=$d['body']??[];
 return ['key'=>$r['doc_key'],'title'=>(string)($b['confirmedTitle']??$d['title']??''),'genre'=>(string)($d['genreId']??''),'ep'=>(string)($d['ep']??''),'lyrics'=>noa_sound_lyrics((string)($b['lyricsBlock']??'')),'description'=>(($d['mediaAvailability']['status']??'')==='public'?(string)($b['youtubeDescription']??$b['songDescription']??$b['descriptionBlock']??''):'')];
}
/** Fixed OpenAI endpoints only. Provider bodies and credentials never reach the browser. */
function na_provider_request(string $path,string $key,?array $body=null):array{
 if(!in_array($path,['/chat/completions','/models/gpt-5-mini','/models/gpt-4.1-mini'],true))throw new InvalidArgumentException('invalid_provider_path');
 $requestId=null;$c=curl_init('https://api.openai.com/v1'.$path);
 $options=[CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>30,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Bearer '.$key],CURLOPT_HEADERFUNCTION=>function($ch,$line)use(&$requestId){if(stripos($line,'x-request-id:')===0){$id=trim(substr($line,13));if(preg_match('/^[A-Za-z0-9_-]{1,128}$/D',$id))$requestId=$id;}return strlen($line);}];
 if($body!==null)$options+=[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($body,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)];curl_setopt_array($c,$options);$raw=curl_exec($c);$http=(int)curl_getinfo($c,CURLINFO_RESPONSE_CODE);curl_close($c);
 if($raw===false)throw new DomainException('ai_result_unconfirmed');
 if(in_array($http,[401,403],true))throw new DomainException('ai_provider_auth');if($http===429)throw new DomainException('ai_provider_rate_limit');if($http===404)throw new DomainException('ai_model_not_supported');if($http<200||$http>=300)throw new DomainException('ai_provider_unavailable');
 try{$data=json_decode($raw,true,512,JSON_THROW_ON_ERROR);}catch(Throwable $e){throw new DomainException('ai_result_unconfirmed');}return ['data'=>$data,'providerRequestId'=>$requestId];
}
function na_text(string $system,array $context,int $tokens=2200,?array &$usage=null):string{
 require_once __DIR__.'/lab-core.php';
 // Shared conservative cost reservation is never labelled an actual provider charge.
 $reservation=lab_lock(function(&$s){$secret=lab_unseal($s['secrets']??null);if(empty($s['config']['textEnabled'])||empty($secret['openaiKey']))throw new DomainException('ai_not_configured');$model=$s['config']['model']??'';if(!in_array($model,['gpt-5-mini','gpt-4.1-mini'],true))throw new DomainException('ai_model_not_supported');$today=gmdate('Y-m-d');$sum=0.0;foreach($s['jobs'] as $j)if(substr($j['costReservedAt']??'',0,10)===$today)$sum+=(float)($j['costReservedUsd']??0);$s['ainoaUsage']=array_filter($s['ainoaUsage']??[],fn($k)=>$k===$today,ARRAY_FILTER_USE_KEY);$used=(float)($s['ainoaUsage'][$today]??0);if(($s['config']['maxJobUsd']??0)<.1||$sum+$used+.1>($s['config']['dailyBudgetUsd']??0))throw new DomainException('ai_budget_exceeded');$s['ainoaUsage'][$today]=$used+.1;return ['key'=>$secret['openaiKey'],'model'=>$model];});
 $usage=['requestedModel'=>$reservation['model'],'reservedUsd'=>.1,'actualUsd'=>null,'costStatus'=>'provider_invoice_pending','startedAt'=>gmdate('c')];
 try{
  $response=na_provider_request('/chat/completions',$reservation['key'],['model'=>$reservation['model'],'messages'=>[['role'=>'system','content'=>$system],['role'=>'user','content'=>json_encode($context,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]],'max_completion_tokens'=>$tokens,'store'=>false]);$r=$response['data'];
  $usage+=['providerRequestId'=>$response['providerRequestId'],'model'=>$r['model']??$reservation['model'],'inputTokens'=>(int)($r['usage']['prompt_tokens']??0),'outputTokens'=>(int)($r['usage']['completion_tokens']??0)];
  if(($r['choices'][0]['finish_reason']??'')!=='stop')throw new DomainException('ai_result_unconfirmed');$text=$r['choices'][0]['message']['content']??'';if(!is_string($text)||trim($text)===''||mb_strlen($text)>20000)throw new DomainException('ai_result_unconfirmed');$usage['status']='succeeded';return trim($text);
 }catch(Throwable $e){$usage['status']='unconfirmed';$usage['error']=$e instanceof DomainException?$e->getMessage():'ai_result_unconfirmed';throw $e;}
 finally{$usage['finishedAt']=gmdate('c');try{lab_lock(function(&$s)use($usage){$s['ainoaRecentUsage'][]=$usage;$s['ainoaRecentUsage']=array_slice($s['ainoaRecentUsage'],-200);});}catch(Throwable $e){error_log('[noa-ai-usage] persistence_unavailable');}}
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
