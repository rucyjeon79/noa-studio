<?php
declare(strict_types=1);
/** N80 Pay. Server-side prices and verified settlement; never calls a payment provider on load. */
function n80_pay_cart_quote(string|array $cart):array{
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
function n80_pay_benefits(array $catalog,array $lines):array{
 if(!$lines||count($lines)>50)throw new DomainException('invalid_cart');$out=['amount'=>0,'points'=>0,'plan'=>null,'days'=>0,'items'=>[]];$seen=[];
 foreach($lines as $r){$id=$r['id']??'';$n=$r['quantity']??0;$price=$r['price']??-1;
 if(!is_string($id)||!isset($catalog[$id])||isset($seen[$id])||!is_int($n)||$n<1||$n>10||!is_int($price)||$price!==$catalog[$id]['price'])throw new DomainException('cart_changed');
 $p=$catalog[$id];if(!$p['orderable']||$p['source']==='goods')throw new DomainException('goods_options_shipping_required');$seen[$id]=true;$out['amount']+=$price*$n;$out['points']+=($p['points']??0)*$n;
 if($p['source']==='vip'){if($out['plan']!==null&&$out['plan']!==$p['plan'])throw new DomainException('mixed_membership');$out['plan']=$p['plan'];$out['days']+=$p['days']*$n;}$out['items'][]=['id'=>$id,'quantity'=>$n,'price'=>$price];}return $out;
}
function n80_pay_validate_paid(array $o,array $s):void{
 if(($s['mode']??'')==='points'){if($s['benefits']['points']!==0||$s['benefits']['plan']===null||($o['mb_id']??'')!==$s['owner']||($o['od_id']??'')!==$s['order']||!in_array($o['od_status']??'',['입금','준비','배송','완료'],true)||(int)($o['od_receipt_price']??-1)!==0||(int)($o['od_receipt_point']??-1)!==$s['benefits']['amount']||(int)($o['od_cancel_price']??-1)!==0||(int)($o['od_misu']??-1)!==0)throw new DomainException('payment_unverified');return;}if(($s['mode']??'')!=='live')throw new DomainException('test_no_fulfillment');
 if(($o['mb_id']??'')!==$s['owner']||($o['od_id']??'')!==$s['order']||($o['od_pg']??'')!=='kcp'||!in_array($o['od_status']??'',['입금','준비','배송','완료'],true)||!preg_match('/^[0-9]{14}$/D',(string)($o['od_tno']??''))||(int)($o['od_receipt_price']??-1)!==$s['benefits']['amount']||(int)($o['od_receipt_point']??-1)!==0||(int)($o['od_cancel_price']??-1)!==0||(int)($o['od_misu']??-1)!==0)throw new DomainException('payment_unverified');
}
