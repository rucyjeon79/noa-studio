<?php
declare(strict_types=1);
require_once __DIR__.'/membership-core.php';
const NV_CATALOG_VERSION=1;
function nv_products():array{
 $out=[];foreach(['vip'=>['별무리 VIP',3,4,3000],'creator'=>['크레이터 VIP',7,8,5000]]as $plan=>$v)foreach([30=>[1,5],365=>[12,10]]as $days=>$rate){$base=$v[3]*$rate[0];$id=$plan.$days;$out[$id]=['id'=>$id,'name'=>$v[0].' '.$days.'일 이용권 -'.$rate[1].'%','plan'=>$plan,'baseLevel'=>$v[1],'paidLevel'=>$v[2],'durationDays'=>$days,'discount'=>$rate[1],'regularPoints'=>$base,'points'=>intdiv($base*(100-$rate[1]),100),'image'=>'/noa-assets/vip-'.$id.'.webp'];}return $out;
}
function nv_quote(array $items):array{
 if(!array_is_list($items)||count($items)<1||count($items)>2)throw new InvalidArgumentException('invalid_cart');
 $catalog=nv_products();$lines=[];$plan=null;$points=0;$days=0;$regular=0;
 foreach($items as $row){$id=$row['productId']??null;$qty=$row['quantity']??null;if(!is_string($id)||!isset($catalog[$id])||!is_int($qty)||$qty<1||$qty>10||isset($lines[$id]))throw new InvalidArgumentException('invalid_cart');$p=$catalog[$id];if($plan!==null&&$plan!==$p['plan'])throw new DomainException('mixed_membership');$plan=$p['plan'];$lines[$id]=$p+['quantity'=>$qty];$points+=$p['points']*$qty;$days+=$p['durationDays']*$qty;$regular+=$p['regularPoints']*$qty;}
 ksort($lines);return ['plan'=>$plan,'items'=>array_values($lines),'points'=>$points,'regularPoints'=>$regular,'durationDays'=>$days,'signature'=>hash('sha256',json_encode(array_map(fn($p)=>[$p['id'],$p['quantity']],array_values($lines))))];
}
function nv_buy(string $owner,string $id,array $items,int $now):array{
 ns_order_key($id);$q=nv_quote($items);
 return ns_atomic($owner,true,function()use($owner,$id,$q,$now){
  $old=ns_doc(ns_order_key($id),true);if($old){$d=$old['data'];if(($d['ownerId']??'')!==$owner||($d['catalog']??'')!=='vip-store-v1'||($d['signature']??'')!==$q['signature'])throw new DomainException('purchase_conflict');return $d;}
  if(empty(nr_policy()['enabled']))throw new DomainException('membership_not_ready');
  $m=nr_member($owner);global $config;$raw=(int)$m['mb_level'];$eligible=$q['plan']==='vip'?in_array($raw,[2,3,4],true):in_array($raw,[7,8],true);
  if(!$eligible||$owner===($config['cf_admin']??''))throw new DomainException('membership_level_required');
  $d=['id'=>$id,'ownerId'=>$owner,'catalog'=>'vip-store-v1','method'=>'points','priceWon'=>0,'provider'=>'GnuBoard points','period'=>'days','timezone'=>'Asia/Seoul','status'=>'processing','createdAt'=>$now]+$q;
  ns_put(ns_order_key($id),'subscription_order',$d,0,$owner);ns_points_debit($owner,$q['points'],$id,'NOA VIP 이용권 · '.$q['durationDays'].'일');$g=ns_grant($d,$owner,$now);$d['status']='paid';$d['paidAt']=$now;$d['until']=$g['until'];ns_put(ns_order_key($id),'subscription_order',$d,1,$owner);nr_sync_member($owner,$now);return $d;
 });
}
