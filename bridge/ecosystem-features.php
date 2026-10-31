<?php
/** Additive discovery, delegated operations and curated commerce; no synthetic activity. */
declare(strict_types=1);
function eco_vip(array $a):bool{
 if($a['admin'])return true;if($a['id']==='')return false;
 if(in_array($a['level'],[5,6],true))return true;
 $g=ns_doc(ns_member_key($a['id']))['data']??[];
 return ($g['ownerId']??'')===$a['id']&&($g['status']??'')==='active'&&(int)($g['until']??0)>time()&&in_array((int)($g['paidLevel']??0),[4,8],true);
}
function eco_can(array $a,string $cap):bool{return $a['admin']||(!empty($a['capabilities'])&&in_array($cap,$a['capabilities'],true));}
function eco_capabilities(array $a):array{if($a['id']===''||!in_array($a['level'],[9],true))return [];return array_values(array_intersect(ns_doc('ecosystem:staff:'.hash('sha256',$a['id']))['data']['capabilities']??[],['community','shop']));}
function eco_staff_save(array $a,array $b):array{
 if(!$a['admin'])throw new DomainException('administrator_required');$member=eco_text($b['member']??'',100,true);$caps=$b['capabilities']??[];
 if(!is_array($caps)||array_diff($caps,['community','shop']))throw new InvalidArgumentException('invalid_capabilities');
 $r=ns_one('SELECT mb_id,mb_level FROM '.ns_table('member_table').' WHERE mb_id='.ns_e($member));if(!$r||!in_array((int)$r['mb_level'],[9],true))throw new DomainException('staff_level_required');
 return ns_atomic('ecosystem:staff',false,function()use($a,$b,$member,$caps){$key='ecosystem:staff:'.hash('sha256',$member);$old=ns_doc($key,true);if(($b['revision']??null)!==($old['revision']??0))throw new DomainException('revision_conflict');$d=['member'=>$member,'capabilities'=>array_values(array_unique($caps)),'at'=>time()];$v=ns_put($key,'ecosystem_staff',$d,$old['revision']??0,$a['id']);return ['revision'=>$v];});
}
function eco_staff_list(array $a):array{if(!$a['admin'])throw new DomainException('administrator_required');$out=[];$q=ns_q("SELECT payload,revision FROM noa_documents WHERE kind='ecosystem_staff' ORDER BY updated_at DESC LIMIT 100");while($r=sql_fetch_array($q))$out[]=json_decode($r['payload'],true)+['revision'=>(int)$r['revision']];return ['items'=>$out];}
function eco_perks_allowed(array $d,array $a):bool{return empty($d['vipOnly'])||((int)($d['releaseAt']??0)>0&&(int)$d['releaseAt']<=time())||eco_vip($a);}
function eco_reference_url(string $url):?array{
 if($url==='')return null;
 if(preg_match('~^https://(?:www\.)?youtube\.com/playlist\?list=([A-Za-z0-9_-]{10,100})$~D',$url,$m))return ['url'=>'https://www.youtube.com/playlist?list='.$m[1],'title'=>'YouTube 플레이리스트'];
 throw new InvalidArgumentException('playlist_url_required');
}
function eco_growth(array $a,array $b):array{
 $post=eco_id((string)($b['id']??''));return ns_atomic('ecosystem:post:'.$post,false,function()use($a,$b,$post){$r=eco_record($post,$a,true);eco_owner($r,$a);if($r['data']['space']!=='lab')throw new DomainException('lab_required');
 $comment=ns_doc('ecosystem:comment:'.eco_id((string)($b['commentId']??'')),true);if(!$comment||$comment['data']['post']!==$post||!empty($comment['data']['deleted']))throw new DomainException('not_found');
 $version=$b['version']??null;if(!is_int($version)||$version<1||!ns_doc('ecosystem:version:'.$post.':'.$version))throw new InvalidArgumentException('invalid_version');$note=eco_text($b['note']??'',2000,true);$comment['data']['resolved']=true;$comment['data']['resolution']=['version'=>$version,'note'=>$note,'at'=>time()];
 ns_put('ecosystem:comment:'.$comment['data']['id'],'ecosystem_comment',$comment['data'],$comment['revision'],$a['id']);eco_note($comment['data']['owner'],$a['id'],$post,'보내주신 피드백이 작품에 반영되었습니다.',$comment['data']['id'].':resolved:'.$version);return ['ok'=>true];});
}
function eco_discovery(array $a,string $space):array{
 $space=$space==='lab'?'lab':'lounge';$sections=[];$names=$space==='lab'?['work'=>'최신 작품','feedback'=>'함께 들어주세요','collaboration'=>'함께 만들 사람을 찾습니다','challenge'=>'창작 챌린지','class'=>'나누는 노하우','growth'=>'작품이 자라는 기록']:['notice'=>'라운지 공지','diary'=>'노아의 소식','event'=>'함께하는 이벤트','music'=>'오늘의 노래','story'=>'당신의 이야기'];
 foreach($names as $category=>$title){$d=eco_list($a,['space'=>$space,'category'=>$category,'perPage'=>4]);$sections[]=['title'=>$title,'category'=>$category,'items'=>array_slice($d['items'],0,4)];}
 $popular=eco_list($a,['space'=>$space,'sort'=>'popular','perPage'=>4]);$sections[]=['title'=>'공감이 이어지는 이야기','sort'=>'popular','items'=>array_slice(array_values(array_filter($popular['items'],fn($p)=>$p['likes']>0)),0,4)];
 $creators=[];if($space==='lab'){$q=ns_q("SELECT payload FROM noa_documents WHERE kind='ecosystem_post' AND ".eco_acl_sql($a)." AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.space'))='lab' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.visibility'))='public' ORDER BY updated_at DESC LIMIT 80");$seen=[];while($r=sql_fetch_array($q)){$p=json_decode($r['payload'],true);$cid=hash('sha256',$p['owner']);if(isset($seen[$cid]))continue;$seen[$cid]=true;$c=ns_doc('creator-channel:'.$cid)['data']??null;if(!$c||($c['ownerId']??'')!==$p['owner'])continue;$creators[]=['id'=>$cid,'title'=>$c['title']??$p['name'],'description'=>mb_substr($c['description']??'',0,140),'work'=>['id'=>$p['id'],'title'=>$p['title']]];if(count($creators)>=4)break;}}
 return ['sections'=>$sections,'creators'=>$creators,'creatorBasis'=>'최근 공개 작품을 공유한 창작자','vip'=>eco_vip($a)];
}
function eco_product_meta(array $p,array $b,array $a):array{
 foreach(['availability'=>120,'optionNote'=>500,'shippingNote'=>1000,'returnNote'=>1000,'campaign'=>120]as $k=>$max)if(array_key_exists($k,$b))$p[$k]=eco_text($b[$k],$max);
 foreach(['featured','recommended','optionsRequired']as $k)if(array_key_exists($k,$b)){$p[$k]=$b[$k]===true;}
 foreach(['musicKeys'=>220,'genres'=>80,'channelIds'=>64,'acts'=>3]as $k=>$max){if(!array_key_exists($k,$b))continue;$items=$b[$k];if(!is_array($items)||count($items)>30)throw new InvalidArgumentException('invalid_product_relations');$p[$k]=[];foreach($items as $v){$v=eco_text($v,$max,true);if($k==='channelIds'&&(!preg_match('/^[a-f0-9]{64}$/D',$v)||!ns_doc('creator-channel:'.$v)))throw new InvalidArgumentException('invalid_channel');if($k==='acts'&&!preg_match('/^[1-9][0-9]?$/D',$v))throw new InvalidArgumentException('invalid_act');if($k==='musicKeys')eco_music($v,$a);$p[$k][]=$v;}$p[$k]=array_values(array_unique($p[$k]));}
 return $p;
}
function eco_related_products(array $q):array{
 $matches=[];$fields=['music'=>'musicKeys','genre'=>'genres','act'=>'acts','channel'=>'channelIds'];foreach(eco_products()as $p){foreach($fields as $input=>$field){$v=(string)($q[$input]??'');if($v!==''&&in_array($v,$p[$field]??[],true)){$matches[]=$p;break;}}}return ['items'=>array_slice($matches,0,6)];
}
function eco_product_popularity():array{$out=[];$q=ns_q("SELECT payload FROM noa_documents WHERE kind='ecosystem_shop'");while($r=sql_fetch_array($q)){foreach(array_unique(json_decode($r['payload'],true)['wishlist']??[])as $id)$out[$id]=($out[$id]??0)+1;}return $out;}

function eco_latest_version(string $id):int{$r=ns_one("SELECT MAX(CAST(JSON_EXTRACT(payload,'$.version') AS UNSIGNED)) n FROM noa_documents WHERE kind='ecosystem_version' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.post'))=".ns_e($id));return (int)($r['n']??0);}

/** Consent is bound to the actual public terms, not merely an unchecked client label. */
function eco_terms(array $d):array{$out=[];foreach(['roles','schedule','compensation','rights']as $key)$out[$key]=$d[$key]??'';return $out;}
function eco_terms_hash(array $d):string{return hash('sha256',json_encode(eco_terms($d),JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));}
function eco_product_ids(mixed $ids):array{if(!is_array($ids)||count($ids)>6)throw new InvalidArgumentException('invalid_product_relations');$out=[];foreach($ids as $id){$id=eco_text($id,80,true);eco_product($id);$out[]=$id;}return array_values(array_unique($out));}
function eco_application(array $a,string $action,array $b,array $r):array{
 $d=$r['data'];$id=$d['id'];if($d['category']!=='collaboration')throw new DomainException('recruitment_closed');
 if($action==='application-review'){
  eco_owner($r,$a);$app=(string)($b['application']??'');if(!preg_match('/^[a-f0-9]{64}$/D',$app)||!in_array($b['status']??'',['accepted','declined'],true))throw new InvalidArgumentException('invalid_application');
  $key='ecosystem:application:'.$app;$old=ns_doc($key,true);if(!$old||$old['data']['post']!==$id)throw new DomainException('not_found');
  if($old['data']['status']!=='requested')throw new DomainException('application_final');
  if($b['status']==='accepted'&&($old['data']['terms']??[])!==eco_terms($d))throw new DomainException('terms_changed');
  $v=$old['data'];$v['status']=$b['status'];$v['updated']=time();$revision=ns_put($key,'ecosystem_application',$v,$old['revision'],$a['id']);
  eco_note($v['owner'],$a['id'],$id,'협업 신청 결과: '.($v['status']==='accepted'?'수락':'거절'),$key.':review:'.$revision);return ['status'=>$v['status'],'revision'=>$revision];
 }
 eco_creator($a);$key='ecosystem:application:'.hash('sha256',$id.'|'.$a['id']);$old=ns_doc($key,true);
 if($action==='application-withdraw'){
  if(!$old||$old['data']['owner']!==$a['id'])throw new DomainException('not_found');
  if(($b['revision']??null)!==$old['revision'])throw new DomainException('revision_conflict');
  if($old['data']['status']!=='requested')throw new DomainException('application_final');
  $v=$old['data'];$v['status']='withdrawn';$v['updated']=time();$revision=ns_put($key,'ecosystem_application',$v,$old['revision'],$a['id']);
  eco_note($d['owner'],$a['id'],$id,'협업 참여 신청이 철회되었습니다.',$key.':withdraw:'.$revision);return ['status'=>'withdrawn','revision'=>$revision];
 }
 if(in_array($d['stage'],['closed','complete'],true))throw new DomainException('recruitment_closed');if($d['owner']===$a['id'])throw new DomainException('own_application');
 if($old&&$old['data']['status']!=='withdrawn')throw new DomainException('already_applied');
 if(($b['consent']??false)!==true)throw new DomainException('terms_confirmation_required');
 if(!is_string($b['termsHash']??null)||!hash_equals(eco_terms_hash($d),$b['termsHash']))throw new DomainException('terms_changed');
 if(($b['applicationRevision']??0)!==($old['revision']??0))throw new DomainException('revision_conflict');
 $v=['id'=>substr($key,strrpos($key,':')+1),'owner'=>$a['id'],'name'=>$a['name'],'channelId'=>hash('sha256',$a['id']),'post'=>$id,'message'=>eco_text($b['message']??'',3000,true),'terms'=>eco_terms($d),'status'=>'requested','at'=>time()];
 $revision=ns_put($key,'ecosystem_application',$v,$old['revision']??0,$a['id']);eco_note($d['owner'],$a['id'],$id,'협업 참여 신청이 도착했습니다.',$key.':apply:'.$revision);return ['status'=>'requested','revision'=>$revision];
}
function eco_report_review(array $a,array $b):array{
 if(!eco_can($a,'community'))throw new DomainException('administrator_required');$key=(string)($b['key']??'');if(!preg_match('/^ecosystem:report:[a-f0-9]{64}$/D',$key)||!in_array($b['decision']??'',['dismissed','hidden'],true))throw new InvalidArgumentException('invalid_report');
 $report=ns_doc($key);if(!$report)throw new DomainException('not_found');$note=eco_text($b['note']??'',1000,true);
 return ns_atomic('ecosystem:post:'.$report['data']['post'],false,function()use($a,$b,$key,$note){
  $r=ns_doc($key,true);if($r['data']['status']!=='open')throw new DomainException('report_closed');$v=$r['data'];$v['status']=$b['decision'];$v['reviewNote']=$note;$v['reviewedAt']=time();$version=ns_put($key,'ecosystem_report',$v,$r['revision'],$a['id']);
  if($v['status']==='hidden'){$p=ns_doc('ecosystem:post:'.$v['post'],true);if(!$p)throw new DomainException('not_found');$p['data']['visibility']='private';ns_put('ecosystem:post:'.$v['post'],'ecosystem_post',$p['data'],$p['revision'],$a['id']);eco_note($p['data']['owner'],$a['id'],$v['post'],'신고 검토에 따라 게시물이 비공개 처리되었습니다.',$key.':author:'.$version,true);}
  eco_note($v['owner'],$a['id'],$v['post'],'신고 처리 결과: '.($v['status']==='hidden'?'게시물 비공개':'검토 후 종결'),$key.':reporter:'.$version,true);return ['status'=>$v['status']];
 });
}
