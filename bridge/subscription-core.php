<?php
declare(strict_types=1);
require_once __DIR__.'/subscription-access.php';
const NS_POLICY='subscription:policy';
function ns_defaults():array{return ['enabled'=>false,'pointsEnabled'=>false,'paymentApprovalEnabled'=>false,'provider'=>'','paymentInstructions'=>'','plans'=>['vip'=>['enabled'=>false,'priceWon'=>null,'points'=>null],'creator'=>['enabled'=>false,'priceWon'=>null,'points'=>null]]];}
function ns_policy_validate(array $p):array{
 $out=ns_defaults();foreach(['enabled','pointsEnabled','paymentApprovalEnabled']as $k){if(!is_bool($p[$k]??null))throw new InvalidArgumentException('invalid_policy');$out[$k]=$p[$k];}
 foreach(['provider'=>80,'paymentInstructions'=>2000]as $k=>$limit){if(!is_string($p[$k]??null)||mb_strlen($p[$k])>$limit||str_contains($p[$k],"\0"))throw new InvalidArgumentException('invalid_policy');$out[$k]=trim($p[$k]);}
 foreach(['vip','creator']as $id){$v=$p['plans'][$id]??null;if(!is_array($v)||!is_bool($v['enabled']??null))throw new InvalidArgumentException('invalid_plan');$out['plans'][$id]['enabled']=$v['enabled'];foreach(['priceWon'=>100000000,'points'=>1000000000]as $k=>$max){$value=$v[$k]??null;if($value!==null&&(!is_int($value)||$value<1||$value>$max))throw new InvalidArgumentException('positive_price_required');$out['plans'][$id][$k]=$value;}}
 foreach(['vip','creator']as $id)if(array_key_exists('durationDays',$p['plans'][$id])){if(!is_int($p['plans'][$id]['durationDays'])||$p['plans'][$id]['durationDays']<1||$p['plans'][$id]['durationDays']>365)throw new InvalidArgumentException('invalid_duration');$out['plans'][$id]['durationDays']=$p['plans'][$id]['durationDays'];}
 if($out['enabled']){foreach($out['plans']as $v)if($v['enabled']){if($out['pointsEnabled']&&$v['points']===null)throw new InvalidArgumentException('points_price_required');if($out['paymentApprovalEnabled']&&($v['priceWon']===null||$out['provider']===''||$out['paymentInstructions']===''))throw new InvalidArgumentException('payment_settings_required');}}
 return $out;
}
function ns_quote(array $policy,string $plan,string $method,int $rawLevel):array{
 if(!in_array($plan,['vip','creator'],true)||!in_array($method,['points','payment'],true))throw new InvalidArgumentException('invalid_plan');
 if(ns_family($rawLevel)!==($plan==='creator'?5:3))throw new DomainException('regular_or_creator_required');
 $p=$policy['plans'][$plan];if(!$policy['enabled']||!$p['enabled'])throw new DomainException('subscription_not_configured');
 if($method==='points'&&(!$policy['pointsEnabled']||!is_int($p['points'])||$p['points']<1))throw new DomainException('points_purchase_disabled');
 if($method==='payment'&&(!$policy['paymentApprovalEnabled']||!is_int($p['priceWon'])||$p['priceWon']<1||$policy['provider']===''||$policy['paymentInstructions']===''))throw new DomainException('payment_purchase_disabled');
 return ['plan'=>$plan,'method'=>$method,'points'=>$method==='points'?$p['points']:0,'priceWon'=>$method==='payment'?$p['priceWon']:0,'provider'=>$method==='payment'?$policy['provider']:'GnuBoard points','period'=>isset($p['durationDays'])?'days':'calendar-month','timezone'=>'Asia/Seoul']+(isset($p['durationDays'])?['durationDays'=>$p['durationDays']]:[]);
}
function ns_q(string $sql){$r=sql_query($sql,false);if($r===false)throw new RuntimeException('subscription_database_unavailable');return $r;}
function ns_e(string $s):string{global $g5;$link=$g5['connect_db']??null;if(!$link instanceof mysqli)throw new RuntimeException('native_database_connection_required');return "'".mysqli_real_escape_string($link,$s)."'";}
function ns_one(string $sql):?array{$r=ns_q($sql);$row=sql_fetch_array($r);return $row?:null;}
function ns_table(string $key):string{global $g5;$v=$g5[$key]??'';if(!preg_match('/^[A-Za-z0-9_]+$/D',$v))throw new RuntimeException('native_point_tables_unavailable');return '`'.$v.'`';}
function ns_doc(string $key,bool $lock=false):?array{$r=ns_one('SELECT kind,payload,revision FROM noa_documents WHERE doc_key='.ns_e($key).($lock?' FOR UPDATE':''));if(!$r)return null;$r['data']=json_decode($r['payload'],true,64,JSON_THROW_ON_ERROR);$r['revision']=(int)$r['revision'];return $r;}
function ns_put(string $key,string $kind,array $data,int $expected,string $actor):int{
 if($expected===0)ns_q('INSERT IGNORE INTO noa_documents(doc_key,kind,payload,revision,updated_by) VALUES('.ns_e($key).','.ns_e($kind).",'{}',0,".ns_e($actor).')');
 $row=ns_doc($key,true);if(!$row||$row['kind']!==$kind||$row['revision']!==$expected)throw new DomainException('revision_conflict');$json=json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);$next=$expected+1;
 ns_q('UPDATE noa_documents SET payload='.ns_e($json).',revision='.$next.',updated_by='.ns_e($actor).' WHERE doc_key='.ns_e($key).' AND revision='.$expected);
 ns_q('INSERT INTO noa_document_history(doc_key,revision,payload,changed_by) VALUES('.ns_e($key).','.$next.','.ns_e($json).','.ns_e($actor).')');$verified=ns_doc($key);if(!$verified||$verified['revision']!==$next||!hash_equals($json,$verified['payload']))throw new RuntimeException('subscription_write_verification_failed');return $next;
}
function ns_policy():array{$r=ns_doc(NS_POLICY);return ['values'=>$r?ns_policy_validate($r['data']):ns_defaults(),'revision'=>$r['revision']??0];}
function ns_storage(bool $points=false):array{
 $tables=['noa_documents','noa_document_history'];if($points)$tables=array_merge($tables,[trim(ns_table('member_table'),'`'),trim(ns_table('point_table'),'`')]);$bad=[];
 foreach($tables as $t){$r=ns_one('SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='.ns_e($t));if(strtoupper((string)($r['ENGINE']??''))!=='INNODB')$bad[]=$t;}
 global $config;return ['ready'=>!$bad&&(!$points||!empty($config['cf_use_point'])),'nonTransactional'=>$bad,'nativePointsEnabled'=>!empty($config['cf_use_point'])];
}
function ns_atomic(string $owner,bool $points,callable $fn){
 $storage=ns_storage($points);if(!$storage['ready'])throw new DomainException($points?'points_storage_not_ready':'subscription_storage_not_ready');$lock='noa-sub:'.substr(hash('sha256',$owner),0,48);$r=ns_one('SELECT GET_LOCK('.ns_e($lock).',5) AS acquired');if((int)($r['acquired']??0)!==1)throw new DomainException('purchase_busy_retry');
 try{ns_q('START TRANSACTION');try{$result=$fn();ns_q('COMMIT');return $result;}catch(Throwable $e){ns_q('ROLLBACK');throw $e;}}finally{ns_q('SELECT RELEASE_LOCK('.ns_e($lock).')');}
}
function ns_native_member(string $owner,bool $lock=true):array{
 $r=ns_one('SELECT mb_id,mb_level,mb_point FROM '.ns_table('member_table').' WHERE mb_id='.ns_e($owner).($lock?' FOR UPDATE':''));if(!$r||ns_family((int)$r['mb_level'])===null)throw new DomainException('regular_or_creator_required');return $r;
}
function ns_order_key(string $id):string{if(!preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/D',$id))throw new InvalidArgumentException('request_id_required');return 'subscription:order:'.$id;}
function ns_grant(array $order,string $actor,int $now):array{
 $key=ns_member_key($order['ownerId']);$r=ns_doc($key,true);$g=$r['data']??null;$base=$order['plan']==='creator'?5:3;
 if($g&&($g['ownerId']??'')!==$order['ownerId'])throw new DomainException('subscription_owner_mismatch');
 $continuing=$g&&($g['baseLevel']??0)===$base&&($g['status']??'')==='active'&&($g['until']??0)>$now;$start=$continuing?$g['until']:$now;$anchor=$continuing?($g['anchorDay']??null):null;$anchor??=(int)(new DateTimeImmutable('@'.$start))->setTimezone(new DateTimeZone('Asia/Seoul'))->format('j');
 $next=['ownerId'=>$order['ownerId'],'baseLevel'=>$base,'paidLevel'=>$base===5?6:4,'status'=>'active','until'=>isset($order['durationDays'])?$start+(int)$order['durationDays']*86400:ns_month_end($start,$anchor),'anchorDay'=>$anchor,'lastOrderId'=>$order['id'],'source'=>$order['method'],'updatedAt'=>$now];ns_put($key,'prefs',$next,$r['revision']??0,$actor);return $next;
}
function ns_points_debit(string $owner,int $points,string $id):void{
 if($points<1||$points>1000000000)throw new InvalidArgumentException('positive_price_required');
 ns_q('SELECT po_id FROM '.ns_table('point_table').' WHERE mb_id='.ns_e($owner).' FOR UPDATE');$balance=(int)get_point_sum($owner);if($balance<$points)throw new DomainException('insufficient_points');
 $receipt=ns_one('SELECT po_id FROM '.ns_table('point_table').' WHERE mb_id='.ns_e($owner)." AND po_rel_table='noa_subscription' AND po_rel_id=".ns_e($id)." AND po_rel_action='purchase'");if($receipt)throw new DomainException('points_receipt_conflict');
 $buffer=ob_get_level();ob_start(static fn($v)=>'');try{$ok=insert_point($owner,-$points,'NOA STUDIO 월 구독','noa_subscription',$id,'purchase');$unexpected=ob_get_contents();}finally{while(ob_get_level()>$buffer)ob_end_clean();}
 if($ok!==1||trim($unexpected)!=='')throw new RuntimeException('points_debit_failed');
 $verified=ns_one('SELECT po_point FROM '.ns_table('point_table').' WHERE mb_id='.ns_e($owner)." AND po_rel_table='noa_subscription' AND po_rel_id=".ns_e($id)." AND po_rel_action='purchase'");if(!$verified||(int)$verified['po_point']!==-$points)throw new RuntimeException('points_debit_failed');
}
function ns_create_order(string $owner,string $id,string $plan,string $method,int $now,?int $expectedPolicyRevision=null,?callable $authorize=null):array{
 ns_order_key($id);return ns_atomic($owner,$method==='points',function()use($owner,$id,$plan,$method,$now,$expectedPolicyRevision,$authorize){
  $old=ns_doc(ns_order_key($id),true);if($old){$d=$old['data'];if(($d['ownerId']??'')!==$owner||($d['plan']??'')!==$plan||($d['method']??'')!==$method)throw new DomainException('purchase_conflict');return $d;}
  if($authorize!==null)$authorize();
  $member=ns_native_member($owner);$policyRow=ns_doc(NS_POLICY,true);if($expectedPolicyRevision!==null&&$expectedPolicyRevision!==($policyRow['revision']??0))throw new DomainException('policy_changed');$policy=$policyRow?ns_policy_validate($policyRow['data']):ns_defaults();$quote=ns_quote($policy,$plan,$method,(int)$member['mb_level']);
  $d=['id'=>$id,'ownerId'=>$owner]+$quote+['status'=>$method==='points'?'processing':'awaiting_payment','createdAt'=>$now,'paidAt'=>null,'until'=>null];ns_put(ns_order_key($id),'subscription_order',$d,0,$owner);
  if($method==='points'){
   ns_points_debit($owner,$quote['points'],$id);
   $g=ns_grant($d,$owner,$now);$d['status']='paid';$d['paidAt']=$now;$d['until']=$g['until'];ns_put(ns_order_key($id),'subscription_order',$d,1,$owner);
  }
  return $d;
 });
}
function ns_confirm_payment(string $id,string $reference,int $amount,string $actor,int $now):array{
 $r=ns_doc(ns_order_key($id));if(!$r)throw new DomainException('order_not_found');$owner=$r['data']['ownerId'];$reference=trim($reference);if($reference===''||mb_strlen($reference)>160||str_contains($reference,"\0"))throw new InvalidArgumentException('payment_reference_required');
 return ns_atomic($owner,false,function()use($id,$reference,$amount,$actor,$now,$owner){$r=ns_doc(ns_order_key($id),true);$d=$r['data'];if($d['method']!=='payment')throw new DomainException('payment_order_required');if($d['status']==='paid'){if($d['paymentReference']!==$reference||$d['priceWon']!==$amount)throw new DomainException('purchase_conflict');return $d;}if($d['status']!=='awaiting_payment'||$d['priceWon']!==$amount)throw new DomainException('payment_amount_mismatch');
  $member=ns_native_member($owner);if(ns_family((int)$member['mb_level'])!==($d['plan']==='creator'?5:3))throw new DomainException('regular_or_creator_required');
  $receiptKey='subscription:receipt:'.hash('sha256',strtolower($d['provider'])."\n".$reference);$receipt=ns_doc($receiptKey,true);if($receipt&&($receipt['data']['orderId']??'')!==$id)throw new DomainException('payment_reference_already_used');
  if(!$receipt)ns_put($receiptKey,'subscription_receipt',['orderId'=>$id,'ownerId'=>$owner,'verifiedBy'=>$actor,'verifiedAt'=>$now],0,$actor);
  $g=ns_grant($d,$actor,$now);$d['status']='paid';$d['paymentReference']=$reference;$d['verifiedBy']=$actor;$d['paidAt']=$now;$d['until']=$g['until'];ns_put(ns_order_key($id),'subscription_order',$d,$r['revision'],$actor);return $d;
 });
}
