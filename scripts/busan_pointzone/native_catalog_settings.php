<?php
if (($_SERVER['REQUEST_METHOD']??'')!=='POST' || !hash_equals('__TOKEN_HASH__',hash('sha256',$_SERVER['HTTP_X_BUSAN_RELEASE']??''))) {http_response_code(404);exit;}
ini_set('display_errors','0');
require_once dirname(__DIR__).'/common.php';
header('Content-Type: application/json');header('Cache-Control: no-store');
try {
    if (G5_MYSQL_DB!=='rucyjeon79'||(defined('G5_USE_SHOP')&&G5_USE_SHOP)) throw new RuntimeException('site mismatch');
    $db=new PDO('mysql:host='.G5_MYSQL_HOST.';dbname='.G5_MYSQL_DB.';charset=utf8mb4',G5_MYSQL_USER,G5_MYSQL_PASSWORD,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    $db->beginTransaction();
    $defaults=$db->query("SELECT de_shop_skin,de_shop_mobile_skin FROM yc5_default FOR UPDATE")->fetchAll(PDO::FETCH_ASSOC);
    if(count($defaults)!==1)throw new RuntimeException('default count');
    $old=$defaults[0];
    foreach($old as $v)if(!in_array($v,['Busan_PointZone','basic'],true))throw new RuntimeException('unrecognized skin setting');
    $keys=['ca_skin_dir','ca_mobile_skin_dir','ca_skin','ca_mobile_skin','ca_img_width','ca_img_height','ca_mobile_img_width','ca_mobile_img_height','ca_list_mod','ca_list_row','ca_mobile_list_mod','ca_mobile_list_row'];
    $row=$db->query("SELECT ca_name,ca_use,".implode(',',$keys)." FROM yc5_category WHERE ca_id='z9' FOR UPDATE")->fetch(PDO::FETCH_ASSOC);
    if(!$row||$row['ca_name']!=='[샘플] POINT ZONE 테스트'||(int)$row['ca_use']!==1)throw new RuntimeException('sample category conflict');
    $count=(int)$db->query("SELECT COUNT(*) FROM yc5_item WHERE ca_id='z9' AND it_use=1 AND it_id IN ('f1000000000000000001','f1000000000000000002','f1000000000000000003','f1000000000000000004','f1000000000000000005','f1000000000000000006','f1000000000000000007')")->fetchColumn();
    if($count!==7)throw new RuntimeException('sample count');
    $desired=['ca_skin_dir'=>'basic','ca_mobile_skin_dir'=>'basic','ca_skin'=>'list.10.skin.php','ca_mobile_skin'=>'list.10.skin.php','ca_img_width'=>300,'ca_img_height'=>300,'ca_mobile_img_width'=>240,'ca_mobile_img_height'=>240,'ca_list_mod'=>3,'ca_list_row'=>3,'ca_mobile_list_mod'=>2,'ca_mobile_list_row'=>5];
    $before=array_intersect_key($row,$desired);
    foreach($desired as $k=>$v)if($before[$k]!==''&&(string)$before[$k]!=='0'&&(string)$before[$k]!==(string)$v)throw new RuntimeException('sample layout conflict');
    $action=$_SERVER['HTTP_X_BUSAN_ACTION']??'';
    if($action==='apply'){
        $db->exec("UPDATE yc5_default SET de_shop_skin='basic',de_shop_mobile_skin='basic'");
        $st=$db->prepare("UPDATE yc5_category SET ".implode(',',array_map(fn($k)=>"$k=?",array_keys($desired)))." WHERE ca_id='z9'");
        $st->execute(array_values($desired));$db->commit();
        echo json_encode(['ok'=>true,'samples'=>7,'before'=>['defaults'=>$old,'category'=>$before],'after'=>['defaults'=>['de_shop_skin'=>'basic','de_shop_mobile_skin'=>'basic'],'category'=>$desired]]);
    } elseif($action==='inspect'){
        $db->rollBack();echo json_encode(['ok'=>true,'samples'=>7,'before'=>['defaults'=>$old,'category'=>$before]]);
    } elseif($action==='restore'){
        $saved=json_decode(file_get_contents('php://input'),true,512,JSON_THROW_ON_ERROR);
        if(array_keys($saved['defaults']??[])!==array_keys($old)||array_keys($saved['category']??[])!==array_keys($before))throw new RuntimeException('backup shape');
        foreach($desired as $k=>$v)if((string)$before[$k]!==(string)$v)throw new RuntimeException('concurrent category change');
        foreach($old as $v)if($v!=='basic')throw new RuntimeException('concurrent default change');
        foreach($saved['defaults'] as $v)if(!in_array($v,['Busan_PointZone','basic'],true))throw new RuntimeException('invalid backup');
        foreach($saved['category'] as $k=>$v)if((string)$v!==''&&(string)$v!=='0'&&(string)$v!==(string)$desired[$k])throw new RuntimeException('invalid category backup');
        $db->prepare('UPDATE yc5_default SET de_shop_skin=?,de_shop_mobile_skin=?')->execute(array_values($saved['defaults']));
        $db->prepare("UPDATE yc5_category SET ".implode(',',array_map(fn($k)=>"$k=?",array_keys($desired)))." WHERE ca_id='z9'")->execute(array_values($saved['category']));
        $db->commit();echo json_encode(['ok'=>true,'restored'=>true]);
    }else throw new RuntimeException('unknown action');
}catch(Throwable $e){if(isset($db)&&$db->inTransaction())$db->rollBack();http_response_code(409);echo json_encode(['ok'=>false,'error'=>$e instanceof RuntimeException?$e->getMessage():'database error']);}
