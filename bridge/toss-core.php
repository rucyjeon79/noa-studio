<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
require_once __DIR__.'/membership-core.php';require_once __DIR__.'/toss-config.php';
function nt_products():array{
 return array_map(static fn($p)=>['id'=>'p'.$p,'priceWon'=>$p,'paidPoints'=>$p,'bonusPoints'=>$p>=10000?intdiv($p,10):0,'totalPoints'=>$p+($p>=10000?intdiv($p,10):0)],[1000,3000,5000,10000,30000,50000]);
}
function nt_quote(string $id):array{foreach(nt_products()as $p)if($p['id']===$id)return $p;throw new InvalidArgumentException('invalid_product');}
/** Canonical cart quote: only server product prices enter the payment ledger. */
function nt_cart_quote(string|array $cart):array{
 if(is_string($cart))$cart=[['productId'=>$cart,'quantity'=>1]];
 if(!array_is_list($cart)||count($cart)<1||count($cart)>6)throw new InvalidArgumentException('invalid_cart');
 $rows=[];
 foreach($cart as $line){
  if(!is_array($line)||!is_string($line['productId']??null)||!is_int($line['quantity']??null)||$line['quantity']<1||$line['quantity']>10)throw new InvalidArgumentException('invalid_cart');
  $p=nt_quote($line['productId']);if(isset($rows[$p['id']]))throw new InvalidArgumentException('invalid_cart');
  $rows[$p['id']]=['productId'=>$p['id'],'quantity'=>$line['quantity'],'unitPriceWon'=>$p['priceWon'],'paidPoints'=>$p['paidPoints'],'bonusPoints'=>$p['bonusPoints']];
 }
 ksort($rows,SORT_STRING);$items=array_values($rows);$q=['priceWon'=>0,'paidPoints'=>0,'bonusPoints'=>0,'totalPoints'=>0,'items'=>$items];
 foreach($items as $item){$n=$item['quantity'];$q['priceWon']+=$item['unitPriceWon']*$n;$q['paidPoints']+=$item['paidPoints']*$n;$q['bonusPoints']+=$item['bonusPoints']*$n;}
 $q['totalPoints']=$q['paidPoints']+$q['bonusPoints'];
 $identity=array_map(static fn($p)=>[$p['productId'],$p['quantity']],$items);
 $q['id']=count($items)===1&&$items[0]['quantity']===1?$items[0]['productId']:'cart_'.hash('sha256',json_encode($identity,JSON_THROW_ON_ERROR));
 return $q;
}
function nt_key(string $id):string{ns_order_key($id);return 'toss:order:'.$id;}
function nt_payment_key(string $key):string{if(!preg_match('/^[A-Za-z0-9_-]{1,200}$/D',$key))throw new InvalidArgumentException('invalid_payment');return $key;}
function nt_order(string $id,?string $owner=null):array{$r=ns_doc(nt_key($id));if(!$r||($owner!==null&&!hash_equals($owner,$r['data']['ownerId'])))throw new DomainException('order_not_found');return $r['data'];}
function nt_mode(array $d,array $c):void{if(!nt_ready($c))throw new DomainException('payment_not_ready');if($d['mode']!==$c['mode']||!hash_equals($d['mid'],$c['mid']))throw new DomainException('payment_configuration_changed');}
function nt_create(string $owner,string $id,string|array $product,int $now,?string $giftRecipient=null,?array $resumeGift=null):array{
 $q=$resumeGift===null?nt_cart_quote($product):null;$key=nt_key($id);$c=nt_config();if(!nt_ready($c))throw new DomainException('payment_not_ready');
 return ns_atomic($owner,true,function()use($owner,$id,$q,$key,$c,$now,$giftRecipient,$resumeGift){nr_member($owner);$old=ns_doc($key,true);if($old){$d=$old['data'];if($d['ownerId']!==$owner||($d['resumeGift']??null)!==$resumeGift||($q!==null&&$d['productId']!==$q['id'])||($d['giftRecipient']??null)!==$giftRecipient)throw new DomainException('purchase_conflict');nt_mode($d,$c);return $d;}
  if($resumeGift!==null){
   require_once __DIR__.'/gift-core.php';
   $item=ng_item($resumeGift['product']);
   ng_recipient($owner,$resumeGift['recipient'],$item['plan']);
   $missing=$item['price']-(int)get_point_sum($owner);
   if($giftRecipient!==null||ng_unlimited($owner)||$missing<=0||$missing>1000000)throw new DomainException('wallet_quote_changed');
   $q=['id'=>'wallet_shortfall','items'=>[],'priceWon'=>$missing,'paidPoints'=>$missing,'bonusPoints'=>0,'totalPoints'=>$missing];
  }
  $customerKey='toss:customer:'.hash('sha256',$owner);$customer=ns_doc($customerKey,true);if(!$customer){ns_put($customerKey,'toss_customer',['key'=>bin2hex(random_bytes(24))],0,$owner);$customer=ns_doc($customerKey);}
  $d=['id'=>$id,'orderId'=>'NOA_'.str_replace('-','',$id),'ownerId'=>$owner,'customerKey'=>$customer['data']['key'],'productId'=>$q['id'],'items'=>$q['items'],'priceWon'=>$q['priceWon'],'paidPoints'=>$q['paidPoints'],'bonusPoints'=>$q['bonusPoints'],'totalPoints'=>$q['totalPoints'],'mode'=>$c['mode'],'mid'=>$c['mid'],'state'=>'created','credited'=>false,'paidReversed'=>0,'bonusReversed'=>0,'createdAt'=>$now,'paymentKey'=>null];
  if($resumeGift!==null)$d['resumeGift']=$resumeGift;
  if($giftRecipient!==null){
   require_once __DIR__.'/gift-core.php';
   $d['giftRecipient']=ng_recipient($owner,$giftRecipient)['mb_id'];
  }
  ns_put($key,'toss_order',$d,0,$owner);return $d;
 });
}
function nt_view(array $d):array{return array_intersect_key($d,array_flip(['id','orderId','productId','items','priceWon','paidPoints','bonusPoints','totalPoints','mode','state','paidReversed','bonusReversed','createdAt','paidAt','giftRecipient','resumeGift']));}
function nt_api(string $method,string $path,?array $body,array $c,string $id=''):array{
 if(defined('NOA_TOSS_TEST_HARNESS')&&PHP_SAPI==='cli'&&isset($GLOBALS['nt_test_transport']))return ($GLOBALS['nt_test_transport'])($method,$path,$body,$c,$id);
 if(!function_exists('curl_init'))throw new DomainException('payment_not_ready');
 $h=curl_init('https://api.tosspayments.com/v1/payments'.$path);$headers=['Authorization: Basic '.base64_encode($c['secretKey'].':'),'Content-Type: application/json'];if($method==='POST')$headers[]='Idempotency-Key: '.$id;
 curl_setopt_array($h,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_CONNECTTIMEOUT=>2,CURLOPT_TIMEOUT=>$method==='GET'?3:10,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_HTTPHEADER=>$headers,CURLOPT_CUSTOMREQUEST=>$method]);
 if($body!==null)curl_setopt($h,CURLOPT_POSTFIELDS,json_encode($body,JSON_THROW_ON_ERROR));
 $raw=curl_exec($h);$code=(int)curl_getinfo($h,CURLINFO_RESPONSE_CODE);curl_close($h);
 if(!is_string($raw)||strlen($raw)>262144||$code<200||$code>=300)throw new DomainException('payment_verification_pending');
 $p=json_decode($raw,true);if(!is_array($p))throw new DomainException('payment_verification_pending');return $p;
}
function nt_validate_payment(array $d,array $p):void{
 $method=$p['method']??'';$provider=$p['easyPay']['provider']??null;
 if(($p['orderId']??'')!==$d['orderId']||($p['mId']??'')!==$d['mid']||($p['currency']??'')!=='KRW'||($p['totalAmount']??null)!==$d['priceWon']||!is_int($p['balanceAmount']??null)||$p['balanceAmount']<0||$p['balanceAmount']>$d['priceWon'])throw new DomainException('payment_amount_mismatch');
 nt_payment_key($p['paymentKey']??'');if($d['paymentKey']!==null&&!hash_equals($d['paymentKey'],$p['paymentKey']))throw new DomainException('purchase_conflict');
 if(!in_array($method,['카드','CARD','간편결제','EASY_PAY'],true)||(in_array($method,['간편결제','EASY_PAY'],true)&&(!is_string($provider)||$provider==='')))throw new DomainException('payment_method_not_supported');
}
function nt_revoke(string $owner,int $points,string $id,string $action):void{
 if($points<1)return;[$rel,$a]=ns_point_relation($id,$action);$level=ob_get_level();ob_start(static fn($v)=>'');
 try{$ok=insert_point($owner,-$points,'NOA 포인트 결제 취소','noa_toss',$rel,$a);$output=ob_get_contents();}finally{while(ob_get_level()>$level)ob_end_clean();}
 if($ok!==1||trim($output)!=='')throw new RuntimeException('payment_reversal_failed');
 $r=ns_one('SELECT po_point FROM '.ns_table('point_table').' WHERE mb_id='.ns_e($owner)." AND po_rel_table='noa_toss' AND po_rel_id=".ns_e($rel).' AND po_rel_action='.ns_e($a));if(!$r||(int)$r['po_point']!==-$points)throw new RuntimeException('payment_reversal_failed');
}
/** Only server API responses reach this function; webhook bodies are never payment evidence. */
function nt_apply(string $id,array $p,int $now):array{
 $d=nt_order($id);nt_validate_payment($d,$p);$status=$p['status']??'';
 if(!in_array($status,['DONE','PARTIAL_CANCELED','CANCELED'],true))throw new DomainException('payment_verification_pending');
 if(($status==='DONE'&&$p['balanceAmount']!==$d['priceWon'])||($status==='CANCELED'&&$p['balanceAmount']!==0))throw new DomainException('payment_amount_mismatch');
 return ns_atomic($d['ownerId'],true,function()use($id,$p,$now,$status){$r=ns_doc(nt_key($id),true);$d=$r['data'];nt_validate_payment($d,$p);nr_member($d['ownerId']);
  $reversed=$d['priceWon']-$p['balanceAmount'];$bonus=(int)ceil($d['bonusPoints']*$reversed/$d['priceWon']);
  if($reversed<$d['paidReversed']||$d['state']==='canceled')return $d;
  $receipt='toss:receipt:'.hash('sha256',$p['paymentKey']);$seen=ns_doc($receipt,true);if($seen&&$seen['data']['orderId']!==$id)throw new DomainException('payment_reference_already_used');if(!$seen)ns_put($receipt,'toss_receipt',['orderId'=>$id],0,$d['ownerId']);
  $live=$d['mode']==='live';if(!$d['credited']&&$status!=='CANCELED'){
   if($live&&empty($d['giftRecipient'])){nr_insert_points($d['ownerId'],$d['paidPoints'],'NOA 포인트권 구매','noa_toss',$id,'paid');if($d['bonusPoints'])nr_insert_points($d['ownerId'],$d['bonusPoints'],'NOA 포인트권 추가 10%','noa_toss',$id,'bonus');}
   $d['credited']=true;$d['paidAt']=$now;
  }
  if($live&&!empty($d['giftRecipient'])){require_once __DIR__.'/gift-core.php';ng_settle_points($d,$reversed,$bonus,$now);}
  elseif($live&&$d['credited']){nt_revoke($d['ownerId'],$reversed-$d['paidReversed'],$id,'cancel_paid_'.$reversed);nt_revoke($d['ownerId'],$bonus-$d['bonusReversed'],$id,'cancel_bonus_'.$bonus);}
  $d['paidReversed']=$reversed;$d['bonusReversed']=$bonus;$d['paymentKey']=$p['paymentKey'];$d['state']=$status==='DONE'?'paid':($status==='CANCELED'?'canceled':'partially_canceled');$d['verifiedAt']=$now;
  if($d!==$r['data'])ns_put(nt_key($id),'toss_order',$d,$r['revision'],$d['ownerId']);if($live)nr_sync_member($d['ownerId'],$now);return $d;
 });
}
function nt_confirm(string $owner,string $id,string $key,int $amount,int $now):array{
 nt_payment_key($key);$d=nt_order($id,$owner);$c=nt_config();nt_mode($d,$c);if($d['priceWon']!==$amount)throw new DomainException('payment_amount_mismatch');
 $d=ns_atomic($owner,true,function()use($id,$key,$now){$r=ns_doc(nt_key($id),true);$d=$r['data'];if($d['paymentKey']!==null&&!hash_equals($d['paymentKey'],$key))throw new DomainException('purchase_conflict');if($d['paymentKey']===null){if($now-$d['createdAt']>3600)throw new DomainException('order_expired');$d['paymentKey']=$key;ns_put(nt_key($id),'toss_order',$d,$r['revision'],$d['ownerId']);}return $d;});
 if(in_array($d['state'],['paid','partially_canceled','canceled'],true))return $d;
 try{$p=nt_api('POST','/confirm',['paymentKey'=>$key,'orderId'=>$d['orderId'],'amount'=>$d['priceWon']],$c,'noa-confirm-'.$id);}catch(DomainException $e){$p=nt_api('GET','/'.rawurlencode($key),null,$c);}
 return nt_apply($id,$p,$now);
}
function nt_sync(string $id,int $now,?string $paymentKey=null):array{$d=nt_order($id);$c=nt_config();nt_mode($d,$c);$key=$d['paymentKey']??$paymentKey;if(!$key)throw new DomainException('payment_verification_pending');nt_payment_key($key);return nt_apply($id,nt_api('GET','/'.rawurlencode($key),null,$c),$now);}
function nt_webhook_valid(string $raw,string $stamp,string $sign,string $secret,int $now):bool{
 if(!preg_match('/^[a-fA-F0-9]{64}$/D',$secret)||strlen($stamp)>64||strlen($sign)>2048)return false;
 try{$at=(new DateTimeImmutable($stamp,new DateTimeZone('Asia/Seoul')))->getTimestamp();}catch(Throwable $e){return false;}if(abs($now-$at)>300)return false;
 // The developer-console security key is hex encoded. Accept the documented text
 // representation and its decoded bytes; both require possession of the same key.
 $expected=[hash_hmac('sha256',$raw.':'.$stamp,$secret,true),hash_hmac('sha256',$raw.':'.$stamp,hex2bin($secret),true)];
 foreach(explode(',',$sign)as $part){$part=trim($part);if(str_starts_with($part,'v1:')){$value=base64_decode(substr($part,3),true);if(is_string($value))foreach($expected as $hash)if(hash_equals($hash,$value))return true;}}return false;
}

