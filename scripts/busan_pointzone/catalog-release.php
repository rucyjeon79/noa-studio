<?php
if ($_SERVER['REQUEST_METHOD'] !== 'POST' ||
    !hash_equals('__TOKEN_HASH__', hash('sha256', $_SERVER['HTTP_X_BUSAN_RELEASE'] ?? ''))) {
    http_response_code(404);
    exit;
}
ini_set('display_errors', '0');
require_once dirname(__DIR__).'/common.php';
header('Content-Type: application/json');
header('Cache-Control: no-store');
try {
    if (G5_MYSQL_DB !== 'rucyjeon79' || (defined('G5_USE_SHOP') && G5_USE_SHOP)) throw new RuntimeException('site mismatch');
    $db = new PDO('mysql:host='.G5_MYSQL_HOST.';dbname='.G5_MYSQL_DB.';charset=utf8mb4', G5_MYSQL_USER, G5_MYSQL_PASSWORD, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    if ((int)$db->query("SELECT GET_LOCK('bpz_catalog_release',5)")->fetchColumn() !== 1) throw new RuntimeException('release busy');
    $db->exec("SET SESSION sql_mode='NO_ENGINE_SUBSTITUTION'");
    foreach (['yc5_item','yc5_category'] as $table) {
        if ($db->query("SELECT ENGINE FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='$table'")->fetchColumn() !== 'InnoDB') throw new RuntimeException('catalog schema mismatch');
    }
    $schema = base64_decode('__ACTIVITY_SCHEMA__');
    foreach (explode(';', preg_replace('/^--.*$/m','',$schema)) as $stmt) {
        $stmt = trim($stmt);
        if ($stmt === '') continue;
        if (!preg_match('/^CREATE TABLE bpz_(activity|participation|entitlement|profile_selection) /',$stmt)) throw new RuntimeException('unexpected schema');
        $db->exec(preg_replace('/^CREATE TABLE /','CREATE TABLE IF NOT EXISTS ',$stmt));
    }
    $db->beginTransaction();
    $category = $db->query("SELECT ca_name,ca_use FROM yc5_category WHERE ca_id='z9' FOR UPDATE")->fetch(PDO::FETCH_ASSOC);
    $categoryName = '[샘플] POINT ZONE 테스트';
    if ($category && ($category['ca_name'] !== $categoryName || (int)$category['ca_use'] !== 1)) throw new RuntimeException('category conflict');
    if (!$category) $db->exec("INSERT INTO yc5_category SET ca_id='z9',ca_name='[샘플] POINT ZONE 테스트',ca_use=1,ca_head_html='',ca_tail_html='',ca_mobile_head_html='',ca_mobile_tail_html=''");
    $items=[
 ['id'=>'f1000000000000000001','name'=>'[샘플] 부산지부 머그컵','price'=>500,'stock'=>10,'desc'=>'일반 상품 · 구매 및 취소 검증'],
 ['id'=>'f1000000000000000002','name'=>'[샘플] 부산지부 우산','price'=>800,'stock'=>3,'desc'=>'복수 상품 주문 검증'],
 ['id'=>'f1000000000000000003','name'=>'[샘플] 오션블루 프로필 테두리','price'=>200,'stock'=>20,'desc'=>'30일 기간제 꾸미기'],
 ['id'=>'f1000000000000000004','name'=>'[샘플] 부산지부 명예 배지','price'=>300,'stock'=>20,'desc'=>'영구 소장 꾸미기'],
 ['id'=>'f1000000000000000005','name'=>'[샘플] 한정 기념품','price'=>1000,'stock'=>1,'desc'=>'마지막 재고 검증'],
 ['id'=>'f1000000000000000006','name'=>'[샘플] 품절 상품','price'=>100,'stock'=>0,'desc'=>'재고 부족 검증'],
 ['id'=>'f1000000000000000007','name'=>'[샘플] 고가 상품','price'=>9000,'stock'=>2,'desc'=>'포인트 부족 검증']
];
    $existing = $db->prepare('SELECT it_name,ca_id,it_price,it_use FROM yc5_item WHERE it_id=? FOR UPDATE');
    $add = $db->prepare("INSERT INTO yc5_item SET it_id=?,ca_id='z9',it_name=?,it_price=?,it_stock_qty=?,it_use=1,it_basic=?,it_explan='',it_explan2='',it_mobile_explan='',it_head_html='',it_tail_html='',it_mobile_head_html='',it_mobile_tail_html='',it_info_value='',it_use_avg=0,it_shop_memo=''");
    $created=0;
    $photo=$db->prepare("UPDATE yc5_item SET it_img1=? WHERE it_id=? AND COALESCE(it_img1,'')=''");
    foreach ($items as $index=>$item) {
        $existing->execute([$item['id']]);
        $row=$existing->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            if ($row['it_name']!==$item['name'] || $row['ca_id']!=='z9' || (int)$row['it_use']!==1 || (int)$row['it_price']!==$item['price']) throw new RuntimeException('sample ID conflict');
        } else {
            $add->execute([$item['id'],$item['name'],$item['price'],$item['stock'],$item['desc']]);
            $created++;
        }
        $photo->execute(['bpz-samples/sample-'.($index+1).'.jpg',$item['id']]);
    }
    $db->commit();
    echo json_encode(['verified'=>count($items),'created'=>$created]);
} catch (Throwable $e) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    http_response_code(409);
    echo json_encode(['error'=>get_class($e)==='RuntimeException'?$e->getMessage():'database operation failed']);
}
