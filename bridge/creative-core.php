<?php
declare(strict_types=1);
/** N80 AI LAB specialist. Canonical documents/history own content; this index owns identity only. */
require_once __DIR__.'/package-record.php';
const NCD_KIND='n80_creative_draft';
const NCD_TARGETS=['title','lyrics','sunoPrompt','geminiPrompt','youtubeTitle','description','communityPost','creativeFields'];
const NCD_REVISABLE=[...NCD_TARGETS,'vocal'];
const NCD_CONDITIONS=['theme','emotion','genre','instruments','vocal','structure','language','prohibitions'];
function ncd_schema(PDO $db):void {
 $db->exec("CREATE TABLE IF NOT EXISTS noa_creative_drafts (draft_id CHAR(32) CHARACTER SET ascii PRIMARY KEY, owner_id VARCHAR(20) NOT NULL, doc_key VARCHAR(191) CHARACTER SET ascii NOT NULL UNIQUE, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, recovery_until BIGINT UNSIGNED NULL, retained_at BIGINT UNSIGNED NULL, INDEX owner_created(owner_id,created_at,draft_id), INDEX recovery_due(recovery_until,draft_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
 $columns=$db->query('SHOW COLUMNS FROM noa_creative_drafts')->fetchAll(PDO::FETCH_COLUMN);
 foreach(['recovery_until','retained_at'] as $column)if(!in_array($column,$columns,true))$db->exec('ALTER TABLE noa_creative_drafts ADD COLUMN '.$column.' BIGINT UNSIGNED NULL');
 $indexes=$db->query('SHOW INDEX FROM noa_creative_drafts')->fetchAll(PDO::FETCH_ASSOC);
 if(!in_array('recovery_due',array_column($indexes,'Key_name'),true))$db->exec('ALTER TABLE noa_creative_drafts ADD INDEX recovery_due(recovery_until,draft_id)');
 // Existing unfinished work receives a full day of grace when this policy is installed.
 $q=$db->prepare("UPDATE noa_creative_drafts c JOIN noa_documents d ON d.doc_key=c.doc_key SET c.retained_at=CASE WHEN JSON_EXTRACT(d.payload,'$._creative.summary.completion')=100 OR JSON_EXTRACT(d.payload,'$._creative.publication.key') IS NOT NULL THEN ? ELSE NULL END,c.recovery_until=CASE WHEN JSON_EXTRACT(d.payload,'$._creative.summary.completion')=100 OR JSON_EXTRACT(d.payload,'$._creative.publication.key') IS NOT NULL THEN NULL ELSE ? END WHERE c.retained_at IS NULL AND c.recovery_until IS NULL AND d.kind='n80_creative_draft'");$q->execute([time(),time()+86400]);
}
function ncd_id(string $id):string {if(!preg_match('/^[a-f0-9]{32}$/D',$id))throw new InvalidArgumentException('invalid_draft_id');return $id;}
function ncd_key(string $id):string{return 'n80:draft:'.ncd_id($id);}
function ncd_json(mixed $v):string{return json_encode($v,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);}
function ncd_hash(mixed $v):string{return hash('sha256',ncd_json($v));}
/** The submitted edit is anchored to current content, never a history entry. */
function ncd_target_keys(mixed $keys):array {
 if(!is_array($keys)||!array_is_list($keys)||!$keys||count($keys)>count(NCD_REVISABLE))throw new InvalidArgumentException('invalid_targets');
 foreach($keys as $key)if(!is_string($key)||!in_array($key,NCD_REVISABLE,true))throw new InvalidArgumentException('invalid_targets');
 if(count(array_unique($keys))!==count($keys))throw new InvalidArgumentException('invalid_targets');
 return array_values(array_intersect(NCD_REVISABLE,$keys));
}
function ncd_revision_input(array $d,string $field,array $targets=[]):array {$c=$d['_creative'];$input=['story'=>$c['story'],'answers'=>$c['answers'],'intent'=>$c['intent'],'fields'=>nup_fields($d),'request'=>$c['requests'][$field]??'','genre'=>$d['genreId'],'ep'=>$d['ep']];if(count($targets)>1){$input['requests']=[];foreach($targets as $key)$input['requests'][$key]=$c['requests'][$key]??'';}return $input;}
function ncd_title_matches(string $field,mixed $value,string $title):bool {
 if(!in_array($field,['youtubeTitle','description','communityPost'],true)||trim($title)==='')return true;
 $normalize=static fn(string $text)=>preg_replace('/\s+/u',' ',trim($text));return is_string($value)&&str_contains($normalize($value),$normalize($title));
}
function ncd_proposal_current(array $d,string $field,array $p):bool {
 if(!isset($p['contextHash'])||!hash_equals($p['contextHash'],ncd_hash(ncd_revision_input($d,$field)))||($p['baseHash']??'')!==ncd_hash(nup_fields($d)[$field]))return false;
 if(ncd_title_matches($field,$p['value'],nup_fields($d)['title']))return true;
 $title=$d['_creative']['proposals']['title']??null;
 return $title&&($title['jobId']??'')===($p['jobId']??'')&&ncd_proposal_current($d,'title',$title)&&ncd_title_matches($field,$p['value'],$title['value']);
}
function ncd_current_proposals(array $d):array {$out=[];foreach($d['_creative']['proposals'] as $key=>$proposal)if(ncd_proposal_current($d,$key,$proposal))$out[$key]=$proposal;return $out;}
/** Validate every selected proposal before one atomic patch; accept same-job siblings in either order. */
function ncd_accept_proposals(array $d,array $keys,string $decision):array {
 if(!in_array($decision,['apply','cancel'],true))throw new InvalidArgumentException('invalid_decision');
 $patch=[];$jobs=[];
 foreach($keys as $key){$p=$d['_creative']['proposals'][$key]??null;if(!$p)throw new DomainException('proposal_not_found');if($decision==='apply'){if(!ncd_proposal_current($d,$key,$p))throw new DomainException('field_changed');$patch[$key]=$p['value'];$jobs[$p['jobId']]=true;}}
 foreach($patch as $key=>$value)if(!ncd_title_matches($key,$value,$patch['title']??nup_fields($d)['title']))throw new DomainException('apply_title_first');
 $siblings=ncd_current_proposals($d);
 if($patch)$d=ncd_fields($d,$patch);
 foreach($keys as $key){unset($d['_creative']['proposals'][$key]);if($decision==='apply')unset($d['_creative']['needsReview'][$key]);}
 foreach($siblings as $key=>$proposal)if(!in_array($key,$keys,true)&&isset($jobs[$proposal['jobId']]))$d['_creative']['proposals'][$key]['contextHash']=ncd_hash(ncd_revision_input($d,$key));
 return $d;
}
function ncd_text(mixed $v,int $max=200000):string {if(!is_string($v)||mb_strlen($v)>$max)throw new InvalidArgumentException('invalid_text');return trim($v);}
function ncd_atomic(PDO $db,callable $fn):mixed{$db->beginTransaction();try{$r=$fn();$db->commit();return $r;}catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}}
function ncd_row(PDO $db,string $id,string $owner,bool $lock=false):array {
 $q=$db->prepare('SELECT d.*,c.recovery_until,c.retained_at FROM noa_creative_drafts c JOIN noa_documents d ON d.doc_key=c.doc_key WHERE c.draft_id=? AND c.owner_id=? AND d.kind=?'.($lock?' FOR UPDATE':''));$q->execute([ncd_id($id),$owner,NCD_KIND]);$r=$q->fetch(PDO::FETCH_ASSOC);if(!$r)throw new DomainException('draft_not_found');$r['document']=json_decode($r['payload'],true,64,JSON_THROW_ON_ERROR);$r['revision']=(int)$r['revision'];foreach(['retained_at','recovery_until'] as $field)$r[$field]=$r[$field]===null?null:(int)$r[$field];return $r;
}
function ncd_put(PDO $db,array $r,array $d,string $owner):array {
 require_once dirname(__DIR__).'/noa-app/jukebox/media-location.php';$d=nml_sync($db,$r['doc_key'],$d);
 $d['_creative']['proposals']=ncd_current_proposals($d);
 $now=time();$retained=(int)($r['retained_at']??0);if(!$retained&&(ncd_completion($d)['percent']===100||!empty($d['_creative']['publication'])))$retained=$now;
 $d['_creative']['hasInput']=true;$d['_creative']['updatedAt']=gmdate('c',$now);$d['visibility']='draft';$d['confirmed']=false;$d['_creative']['summary']=['id'=>$d['_creative']['id'],'title'=>nup_fields($d)['title']?:mb_substr($d['_creative']['story'],0,40),'genre'=>$d['genreId'],'stage'=>ncd_stage($d),'completion'=>ncd_completion($d)['percent'],'updatedAt'=>$d['_creative']['updatedAt'],'createdAt'=>$d['_creative']['createdAt']];
 if($retained)$r['revision']=nup_store($db,$r['doc_key'],NCD_KIND,$d,$r['revision'],$owner);
 else { // One replaceable recovery checkpoint, not a history row per keystroke.
  if($r['revision']===0){$q=$db->prepare("INSERT INTO noa_documents(doc_key,kind,payload,revision,updated_by) VALUES(?,?,'{}',0,?)");$q->execute([$r['doc_key'],NCD_KIND,$owner]);}
  $q=$db->prepare('UPDATE noa_documents SET payload=?,revision=revision+1,updated_by=? WHERE doc_key=? AND kind=? AND revision=?');$q->execute([ncd_json($d),$owner,$r['doc_key'],NCD_KIND,$r['revision']]);if($q->rowCount()!==1)throw new DomainException('revision_conflict');$r['revision']++;
 }
 $r['retained_at']=$retained?:null;$r['recovery_until']=$retained?null:$now+86400;
 $db->prepare('UPDATE noa_creative_drafts SET retained_at=?,recovery_until=? WHERE draft_id=? AND owner_id=?')->execute([$r['retained_at'],$r['recovery_until'],$d['_creative']['id'],$owner]);$r['document']=$d;return $r;
}
function ncd_meaningful(mixed $value):bool {if(is_array($value)){foreach($value as $v)if(ncd_meaningful($v))return true;return false;}return is_string($value)&&trim($value)!=='';}
function ncd_completion(array $d):array {$f=nup_fields($d);$missing=[];foreach(NCD_TARGETS as $key){$v=$f[$key]??'';if($key==='creativeFields'){$v=trim((string)($v['storyPlan']??''));}if($v===''||$v===[])$missing[]=$key;}if(($f['vocal']??'')==='')$missing[]='vocal';return ['percent'=>(int)floor((9-count($missing))*100/9),'missing'=>$missing];}
function ncd_stage(array $d):string {$c=$d['_creative'];if(!empty($c['deletedAt']))return 'deleted';if(!empty($c['publication']))return 'published';if(!empty($c['intentConfirmed']))return ncd_completion($d)['percent']===100?'review':'writing';return !empty($c['questions'])?'questions':(!empty($c['intent'])?'intent':'story');}
function ncd_view(array $r):array {
 $d=$r['document'];$c=$d['_creative'];$f=nup_fields($d);$f['ep']=(string)($d['ep']??'');
 $c['proposals']=ncd_current_proposals($d);
 require_once dirname(__DIR__).'/noa-app/jukebox/core.php';require_once __DIR__.'/music-download-core.php';
 return ['id'=>$c['id'],'key'=>$r['doc_key'],'revision'=>$r['revision'],'fields'=>$f,'type'=>nup_type($d,'single'),'genre'=>$d['genreId'],'creative'=>$c,'stage'=>ncd_stage($d),'completion'=>ncd_completion($d),'sunoTitle'=>substr(nmd_filename($d),0,-4),'storage'=>['mode'=>empty($r['retained_at'])?'recovery':'draft','expiresAt'=>empty($r['retained_at'])?(int)$r['recovery_until']:null]];
}
function ncd_create(PDO $db,string $owner,string $id,string $story,array $initial=[]):array {
 return ncd_atomic($db,function()use($db,$owner,$id,$story,$initial){$q=$db->prepare('INSERT IGNORE INTO noa_creative_drafts(draft_id,owner_id,doc_key) VALUES(?,?,?)');$q->execute([ncd_id($id),$owner,ncd_key($id)]);if(!$q->rowCount())return ncd_row($db,$id,$owner,true);
  $d=nup_normalize(['ownerId'=>$owner,'channelId'=>hash('sha256',$owner),'genreId'=>'your-story','ep'=>'','act'=>'','title'=>'','visibility'=>'draft','body'=>[], '_creative'=>['id'=>$id,'story'=>ncd_text($story,20000),'answers'=>[],'questions'=>[],'intent'=>[],'intentConfirmed'=>false,'requests'=>[],'proposals'=>[],'needsReview'=>[],'collections'=>[],'createdAt'=>gmdate('c'),'updatedAt'=>gmdate('c')]],NCD_KIND);
  $d=ncd_patch($d,array_intersect_key($initial,array_flip(['fields','requests'])));
  if(!ncd_meaningful([$d['_creative']['story'],$initial['fields']??[],$initial['requests']??[]]))throw new InvalidArgumentException('content_required');
  return ncd_put($db,['doc_key'=>ncd_key($id),'revision'=>0],$d,$owner);
 });
}
function ncd_editable(array $r,int $revision):void {if($r['revision']!==$revision)throw new DomainException('revision_conflict');if(!empty($r['document']['_creative']['deletedAt']))throw new DomainException('draft_deleted');if(!empty($r['document']['_creative']['publication']))throw new DomainException('draft_published');}
function ncd_invalidate(array &$d,string $field):void {
 $c=&$d['_creative'];unset($c['preview']);
 $related=match($field){'title'=>['geminiPrompt','youtubeTitle','description','communityPost'],'lyrics'=>['sunoPrompt','description','communityPost'],'sunoPrompt'=>['lyrics'],'vocal'=>['lyrics','sunoPrompt','geminiPrompt','description'],default=>[]};
 foreach($related as $key)if(nup_fields($d)[$key]!=='')$c['needsReview'][$key]=$field.' 변경 후 확인 필요';
}
/** Apply canonical aliases, including deliberate clears. No removed editor fields are accepted. */
function ncd_fields(array $d,array $patch):array {
 $allowed=array_merge(NCD_TARGETS,['vocal','sunoUrl','youtubeUrl','mvUrl']);
 if(array_diff(array_keys($patch),$allowed))throw new InvalidArgumentException('unknown_field');
 foreach($patch as $key=>$v){if($key==='creativeFields'){if(!is_array($v)||array_diff(array_keys($v),NUP_EXTRA_FIELDS))throw new InvalidArgumentException('invalid_creative_fields');foreach($v as $x)if(!is_string($x))throw new InvalidArgumentException('invalid_creative_fields');}else{$patch[$key]=ncd_text($v,$key==='title'?500:200000);if(in_array($key,['sunoUrl','youtubeUrl','mvUrl'],true)&&$v!==''&&!preg_match('~^https://[^\s<>]+$~D',$v))throw new InvalidArgumentException('invalid_url');}}
 if(isset($patch['vocal'])&&!in_array($patch['vocal'],['','여자솔로','남자솔로','남녀듀엣'],true))throw new InvalidArgumentException('invalid_vocal');
 $f=nup_fields($d);foreach($patch as $key=>$v)if(($f[$key]??null)!==$v)ncd_invalidate($d,$key);
 // The shared patcher preserves empty old aliases; clear only aliases belonging to explicit empty fields first.
 $aliases=['title'=>['displayTitle','confirmedTitle'],'lyrics'=>['lyricsBlock'],'sunoPrompt'=>['sunoPrompt','sunoStyle'],'vocal'=>['vocalInfo','vocal','sourceVocal'],'description'=>['youtubeDescription','descriptionBlock','description'],'communityPost'=>['communityPost','fanLetter'],'sunoUrl'=>['sunoUrl','sunoShareUrl'],'mvUrl'=>['mvUrl','musicVideoUrl']];
 foreach($patch as $key=>$v)if($v===''){foreach($aliases[$key]??[$key] as $a)$d['body'][$a]='';if($key==='title')$d['title']='';}
 if(($patch['title']??null)==='')unset($patch['title']);$d=nup_patch($d,NCD_KIND,$patch);if($d['genreId']==='kpop-original'){$f=nup_fields($d);$d['body']['originalInfo']=['ep'=>$d['ep'],'title'=>$f['title'],'lyrics'=>$f['lyrics'],'vocal'=>$f['vocal']];}return $d;
}
function ncd_patch(array $d,array $b):array {$c=&$d['_creative'];
  if(array_key_exists('story',$b)&&($story=ncd_text($b['story'],20000))!==$c['story']){$c['story']=$story;$c['questions']=[];$c['intent']=[];$c['intentConfirmed']=false;foreach(NCD_TARGETS as $key)if(nup_fields($d)[$key]!==''&&nup_fields($d)[$key]!==[])$c['needsReview'][$key]='이야기 변경 후 확인 필요';}
  if(isset($b['fields']))$d=ncd_fields($d,$b['fields']);
  if(isset($b['progress'])){$pos=filter_var($b['progress'],FILTER_VALIDATE_INT);if($pos===false||$pos<0||$pos>count($d['_creative']['questions']))throw new InvalidArgumentException('invalid_progress');$d['_creative']['questionPosition']=$pos;}
  if(isset($b['answerDrafts']))foreach($b['answerDrafts'] as $k=>$v){if(!in_array($k,NCD_CONDITIONS,true))throw new InvalidArgumentException('unknown_condition');$d['_creative']['answerDrafts'][$k]=ncd_text($v,4000);}
  if(isset($b['requests'])){foreach($b['requests'] as $k=>$v){if(!in_array($k,NCD_REVISABLE,true))throw new InvalidArgumentException('unknown_field');$request=ncd_text($v,4000);if(($d['_creative']['requests'][$k]??'')!==$request)unset($d['_creative']['proposals'][$k]);$d['_creative']['requests'][$k]=$request;}}
  if(isset($b['location'])){$loc=$b['location'];$genre=$loc['genre']??'';if(!in_array($genre,['kpop-original','your-story'],true))throw new DomainException('new_original_category_required');$ep=(string)($loc['ep']??'');if($ep!==''&&!preg_match('/^[1-9][0-9]{0,3}$/D',$ep))throw new InvalidArgumentException('invalid_ep');if($genre==='your-story')$ep='';if($d['genreId']!==$genre||(string)$d['ep']!==$ep)foreach(['geminiPrompt','youtubeTitle','description','communityPost'] as $key)if(nup_fields($d)[$key]!=='')$d['_creative']['needsReview'][$key]='게시 위치·EP 변경 후 확인 필요';$d['genreId']=$genre;$d['ep']=$ep;$d['act']=$ep!==''?(string)ceil((int)$ep/10):'';$d['packageType']=nup_type($d,'single');$collections=$loc['collections']??[];if(!is_array($collections)||count($collections)>20)throw new InvalidArgumentException('invalid_collections');foreach($collections as $key)if(!is_string($key)||!preg_match('/^playlist:custom:[a-f0-9]{24}$/D',$key))throw new InvalidArgumentException('invalid_collections');$d['_creative']['collections']=array_values(array_unique($collections));$d['_creative']['locationConfirmed']=true;}
  if($d['genreId']==='kpop-original'){$f=nup_fields($d);$d['body']['originalInfo']=['ep'=>$d['ep'],'title'=>$f['title'],'lyrics'=>$f['lyrics'],'vocal'=>$f['vocal']];}unset($d['_creative']['preview']);return $d;
}
function ncd_save(PDO $db,string $owner,array $b):array {
 return ncd_atomic($db,function()use($db,$owner,$b){$r=ncd_row($db,$b['id'],$owner,true);ncd_editable($r,(int)($b['revision']??-1));$d=ncd_patch($r['document'],$b);if($d===$r['document'])return $r;return ncd_put($db,$r,$d,$owner);});
}
function ncd_action(PDO $db,string $owner,string $action,array $b):array {
 return ncd_atomic($db,function()use($db,$owner,$action,$b){$r=ncd_row($db,$b['id'],$owner,true);$d=$r['document'];$c=&$d['_creative'];if($r['revision']!==(int)($b['revision']??-1))throw new DomainException('revision_conflict');
  if($action==='delete'){if(($b['confirm']??'')!==$b['id'])throw new DomainException('delete_confirmation_required');$c['deletedAt']=gmdate('c');$c['deletedBy']=$owner;}
  elseif($action==='restoreDeleted'){unset($c['deletedAt'],$c['deletedBy']);}
  else {ncd_editable($r,$r['revision']);
   if($action==='answer'){$key=$b['condition']??'';$question=$c['questions'][$key]??null;if(!$question)throw new DomainException('question_not_found');$answer=ncd_text($b['answer']??'',4000);if($answer==='')throw new InvalidArgumentException('answer_required');$c['answers'][$key]=$answer;$c['questionPosition']=min((int)array_search($key,array_keys($c['questions']),true)+1,count($c['questions'])-1);$c['intent'][$key]=['value'=>$answer,'evidence'=>$answer,'source'=>'answer'];$c['intentConfirmed']=false;}
   elseif($action==='confirmIntent'){foreach(NCD_CONDITIONS as $key)if(empty($c['intent'][$key]['value'])||(isset($c['questions'][$key])&&empty($c['answers'][$key])))throw new DomainException('unanswered_questions');$c['intentConfirmed']=true;$c['intentHash']=ncd_hash($c['intent']);}
   elseif($action==='proposal'){$d=ncd_accept_proposals($d,ncd_target_keys($b['fields']??[$b['field']??'']),$b['decision']??'');}
   elseif($action==='review'){$key=$b['field']??'';if(!in_array($key,NCD_REVISABLE,true))throw new InvalidArgumentException('unknown_field');unset($c['needsReview'][$key]);}
   elseif($action==='restoreField'){$key=$b['field']??'';if(!in_array($key,NCD_REVISABLE,true))throw new InvalidArgumentException('unknown_field');$q=$db->prepare('SELECT payload FROM noa_document_history WHERE doc_key=? AND revision=?');$q->execute([$r['doc_key'],(int)($b['version']??0)]);$old=$q->fetchColumn();if(!$old)throw new DomainException('version_not_found');$d=ncd_fields($d,[$key=>nup_fields(json_decode($old,true))[$key]]);}
   else throw new InvalidArgumentException('unknown_action');
  }
  unset($d['_creative']['preview']);return ncd_put($db,$r,$d,$owner);
 });
}
function ncd_history(PDO $db,array $r,string $field):array {if(!in_array($field,NCD_REVISABLE,true))throw new InvalidArgumentException('unknown_field');$q=$db->prepare('SELECT revision,payload FROM noa_document_history WHERE doc_key=? ORDER BY revision DESC LIMIT 150');$q->execute([$r['doc_key']]);$out=[];$last=null;foreach($q as $row){$v=nup_fields(json_decode($row['payload'],true))[$field];$hash=ncd_hash($v);if($last!==$hash){$out[]=['revision'=>(int)$row['revision'],'value'=>$v];$last=$hash;}}return $out;}
