<?php
require __DIR__.'/../../bridge/ecosystem-catalog.php';
function check($yes){if(!$yes)throw new Exception('Catalog regression');}
$d=json_decode(file_get_contents('marpple-proof/catalog.json'),true);
check(eco_catalog_snapshot('marpple-proof/catalog.json')!==null);
$p=$d['products'][0];$old=$p;$old['priceWon']=1;$old['image']='/old.jpg';$old['recommended']=true;$old['musicKeys']=['saved'];
$r=eco_catalog_merge([$old],[array_replace($old,['hidden'=>true])],$d,true);check($r[0]['priceWon']===$p['priceWon']);check($r[0]['image']===$p['image']);check($r[0]['recommended']);check($r[0]['musicKeys']===['saved']);check(count(eco_catalog_merge([$old],[array_replace($old,['hidden'=>true])],$d))===$d['count']-1);
check(count(eco_catalog_merge([],[],null))===0);check(count(eco_catalog_merge([$old],[],null))===1);
check(!eco_catalog_image('https://common.image.cf.marpple.co.evil.test/a'));
check(!eco_catalog_image('javascript:alert(1)'));
$bad=$d;$bad['count']++;$tmp=tempnam(sys_get_temp_dir(),'catalog');file_put_contents($tmp,json_encode($bad));check(eco_catalog_snapshot($tmp)===null);unlink($tmp);
$removed=$d;$removed['products']=array_slice($d['products'],1);check(count(eco_catalog_merge([$old],[$old],$removed,true))===count($removed['products']));
echo "CATALOG_VALIDATION_SOURCE_REFRESH_EDITORIAL_PRESERVATION_RETIREMENT_OK\n";
