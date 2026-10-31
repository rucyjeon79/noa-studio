<?php
declare(strict_types=1);
// Public catalog snapshots are produced by the scheduled storefront collector.
function eco_catalog_snapshot(?string $file=null):?array{
 $file??=dirname(__DIR__).'/data/noa-marpple-catalog.json';
 if(!is_file($file))return null;
 try{$d=json_decode(file_get_contents($file),true,32,JSON_THROW_ON_ERROR);}catch(Throwable $e){return null;}
 if(($d['version']??0)!==1||($d['complete']??false)!==true||!is_array($d['products']??null)||count($d['products'])!==($d['count']??0)||!$d['count']||!strtotime($d['checkedAt']??''))return null;
 $seen=[];
 foreach($d['products']as $p){$id=(string)($p['id']??'');if(!preg_match('/^[0-9]+$/D',$id)||isset($seen[$id])||($p['url']??'')!=='https://marpple.shop/kr/jr_lifestyle/products/'.$id||!is_int($p['priceWon']??null)||$p['priceWon']<1||empty($p['title'])||!eco_catalog_image((string)($p['image']??'')))return null;$seen[$id]=true;}
 return $d;
}
function eco_catalog_image(string $url):bool{
 $p=parse_url($url);return is_array($p)&&($p['scheme']??'')==='https'&&!isset($p['user'])&&!isset($p['pass'])&&!isset($p['port'])&&in_array($p['host']??'',['common.image.cf.marpple.co','s3.marpple.co'],true);
}
function eco_catalog_merge(array $base,array $custom,?array $snapshot,bool $hidden=false):array{
 $prior=[];foreach(array_merge($base,$custom)as $p)$prior[(string)$p['id']]=$p;
 if($snapshot===null)$out=$prior;
 else{$out=[];foreach($snapshot['products']as $p){$old=$prior[(string)$p['id']]??[];$extra=array_intersect_key($old,array_flip(['featured','recommended','hidden','campaign','musicKeys','genres','channelIds','acts','description','shippingNote','returnNote']));$out[(string)$p['id']]=array_replace($p,$extra);}}
 return array_values(array_filter($out,fn($p)=>$hidden||empty($p['hidden'])));
}
