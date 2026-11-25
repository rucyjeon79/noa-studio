<?php
require_once dirname(__DIR__,2).'/common.php';
if(empty($is_member)||empty($member['mb_id'])||!empty($member['mb_leave_date'])||!empty($member['mb_intercept_date'])){http_response_code(403);exit;}
header('Cache-Control: private, no-store');
$bpz_base=G5_URL.'/theme/Busan_PointZone';
$bpz_owner=(string)$member['mb_id'];
$bpz_csrf=get_session('ss_bpz_order_csrf');
if(!is_string($bpz_csrf)||!preg_match('/^[a-f0-9]{64}$/D',$bpz_csrf)||get_session('ss_bpz_order_csrf_owner')!==$bpz_owner){$bpz_csrf=bin2hex(random_bytes(32));set_session('ss_bpz_order_csrf',$bpz_csrf);set_session('ss_bpz_order_csrf_owner',$bpz_owner);set_session('ss_bpz_action_result',null);}
$bpz_cart=get_session('ss_bpz_native_cart');
if(!is_string($bpz_cart)||!preg_match('/^[1-9][0-9]{14}$/D',$bpz_cart)||get_session('ss_bpz_cart_owner')!==$bpz_owner){
    $bpz_cart=(string)random_int(100000000000000,999999999999999);
    set_session('ss_bpz_native_cart',$bpz_cart);set_session('ss_bpz_cart_owner',$bpz_owner);
}
$bpz_request=get_session('ss_bpz_purchase_request');
if(!is_string($bpz_request)||!preg_match('/^[a-f0-9]{32}$/D',$bpz_request)||get_session('ss_bpz_request_cart')!==$bpz_cart){
    $bpz_request=bin2hex(random_bytes(16));set_session('ss_bpz_purchase_request',$bpz_request);set_session('ss_bpz_request_cart',$bpz_cart);
}
// Deployment package maps the reviewed engine sources to lib/engine.
// No flag from a client, session or HTTP parameter can open this gate.
$bpz_engine=__DIR__.'/lib/engine';
$bpz_enabled=false;
if(is_file($bpz_engine.'/checkout-readiness.php')){
    require_once $bpz_engine.'/checkout-readiness.php';
    try{BusanCheckoutReadiness::liveCheckout();$bpz_enabled=true;}catch(Throwable $e){}
}
// Cart changes are shop-only; never debit points, create orders or reserve stock.
$bpz_cartEnabled=false;$bpz_db=null;
try{
    require_once $bpz_engine.'/pointzone-actions.php';
    require_once $bpz_engine.'/native-cart.php';
    if(defined('BPZ_ISOLATED_FIXTURE')&&BPZ_ISOLATED_FIXTURE===true&&getenv('BUSAN_FIXTURE_DB')==='pointzone_fixture'){
        $bpz_db=$GLOBALS['db'];
        if($bpz_db->query('SELECT DATABASE()')->fetchColumn()!=='pointzone_fixture')throw new RuntimeException('fixture mismatch');
    }else{
        if(!defined('G5_MYSQL_DB')||G5_MYSQL_DB!=='rucyjeon79'||(defined('G5_USE_SHOP')&&G5_USE_SHOP))throw new RuntimeException('site mismatch');
        $bpz_db=new PDO('mysql:host='.G5_MYSQL_HOST.';dbname='.G5_MYSQL_DB.';charset=utf8mb4',G5_MYSQL_USER,G5_MYSQL_PASSWORD,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
    }
    $bpz_engines=$bpz_db->query("SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('yc5_cart','yc5_item','yc5_category','yc5_item_option','yc5_order')")->fetchAll(PDO::FETCH_KEY_PAIR);
    foreach(['yc5_cart','yc5_item','yc5_category','yc5_item_option','yc5_order'] as $bpz_table)if(strtoupper((string)($bpz_engines[$bpz_table]??''))!=='INNODB')throw new RuntimeException('cart schema unavailable');
    $bpz_cartEnabled=true;
}catch(Throwable $e){}
if(($_SERVER['REQUEST_METHOD']??'GET')==='POST'){
    $bpz_action=$_POST['action']??null;
    $bpz_isCart=in_array($bpz_action,['cart_set','cart_remove'],true);
    if(!$bpz_isCart||!$bpz_cartEnabled){http_response_code(503);exit('현재 포인트 구매 및 주문 변경은 준비 중입니다.');}
    try{
        $bpz_cartApi=new BusanNativeCart($bpz_db);
        $bpz_controller=new BusanPointZoneActions(static function($action,$who,$cartId,$p)use($bpz_cartApi){
            if($action==='cart_set')$bpz_cartApi->set($who,$cartId,$p['item'],(int)$p['qty']);
            elseif($action==='cart_remove')$bpz_cartApi->remove($who,$cartId,$p['item']);
            else throw new DomainException('cart only');
            return ['state'=>'cart_updated'];
        });
        $bpz_result=$bpz_controller->handle(['member'=>$bpz_owner,'active'=>true,'super'=>($is_admin??'')==='super'],$bpz_csrf,$bpz_cart,'POST',$_POST);
        set_session('ss_bpz_action_result',$bpz_result);
        header('Location: '.$bpz_base.'/checkout.php',true,303);exit;
    }catch(DomainException $e){http_response_code(400);exit('장바구니 요청 또는 재고를 확인해 주세요.');}
    catch(Throwable $e){http_response_code(503);exit('장바구니를 변경할 수 없습니다.');}
}
if(($_SERVER['REQUEST_METHOD']??'GET')!=='GET'){http_response_code(405);exit;}
$g5['title']='장바구니 및 포인트 결제';
$bpz_rows=[];$bpz_loadError=false;
try{
    $q="SELECT it_id,it_name,ct_qty,ct_price FROM yc5_cart WHERE od_id='".sql_real_escape_string($bpz_cart)."' AND mb_id='".sql_real_escape_string($bpz_owner)."' AND ct_status='쇼핑' ORDER BY ct_id LIMIT 100";
    $rs=sql_query($q,false);if($rs===false)throw new RuntimeException('cart query');
    while($bpz_r=sql_fetch_array($rs))$bpz_rows[]=$bpz_r;
}catch(Throwable $e){$bpz_loadError=true;}
$bpz_result=get_session('ss_bpz_action_result');set_session('ss_bpz_action_result',null);
require_once __DIR__.'/lib/order-views.php';
$bpz_selected=null;$bpz_cancelOrder=null;
try{
    $bpz_item=$_GET['item']??null;$bpz_order=$_GET['order']??null;
    if(is_string($bpz_item)&&preg_match('/^[a-f0-9]{20}$/D',$bpz_item)){
        foreach(BusanOrderViews::catalog($bpz_item) as $bpz_r)if($bpz_r['it_id']===$bpz_item){$bpz_selected=$bpz_r;break;}
    }
    if(is_string($bpz_order)&&preg_match('/^[1-9][0-9]{14}$/D',$bpz_order)){
        foreach(BusanOrderViews::orders() as $bpz_r)if((string)$bpz_r['od_id']===$bpz_order&&$bpz_r['od_status']==='입금'){$bpz_cancelOrder=$bpz_r;break;}
    }
}catch(Throwable $e){}
require __DIR__.'/shop/shop.head.php';
function bpz_action_fields($bpz_csrf,$action){echo '<input type="hidden" name="csrf" value="'.bpz_theme_escape($bpz_csrf).'"><input type="hidden" name="action" value="'.bpz_theme_escape($action).'">';}
?>
<section class="bpz-hero"><p class="bpz-kicker">POINT CHECKOUT</p><h1>장바구니 및 포인트 결제</h1><p>기존 보유 포인트로만 결제합니다.</p><div class="bpz-balance"><span>보유 포인트</span><strong><?php echo number_format((int)$member['mb_point']); ?> P</strong></div></section>
<?php if(!$bpz_enabled){ ?><section class="bpz-card" role="status">장바구니는 이용할 수 있습니다. 포인트 결제·취소는 검증 전 잠금 상태입니다.</section><?php } ?>
<?php if(is_array($bpz_result)){ ?><section class="bpz-card" role="status"><?php echo bpz_theme_escape(['paid'=>'구매 완료','cancelled'=>'취소 완료','cart_updated'=>'장바구니 변경 완료','check_required'=>'주문 상태를 확인해 주세요. 같은 결제를 다시 실행하지 마세요.'][$bpz_result['state']??'']??'거래 상태 확인'); ?>
<?php if(($is_admin??'')==='super'&&isset($bpz_result['can_finalize'],$bpz_result['order'])){ ?><p>주문 <?php echo bpz_theme_escape($bpz_result['order']); ?> · 확인된 포인트 기록 <?php echo bpz_theme_escape($bpz_result['point_id']??'없음'); ?></p><?php } ?></section><?php } ?>
<?php if($bpz_selected!==null){ ?><section class="bpz-card"><h2><?php echo bpz_theme_escape($bpz_selected['it_name']); ?></h2><p><?php echo number_format((int)$bpz_selected['it_price']); ?> P · 재고 <?php echo number_format((int)$bpz_selected['it_stock_qty']); ?>개</p>
<form method="post"><fieldset<?php if(!$bpz_cartEnabled||(int)$bpz_selected['it_stock_qty']<1)echo ' disabled'; ?>><?php bpz_action_fields($bpz_csrf,'cart_set'); ?><input type="hidden" name="item" value="<?php echo bpz_theme_escape($bpz_selected['it_id']); ?>"><label>수량 <input name="qty" type="number" min="1" max="<?php echo (int)$bpz_selected['it_stock_qty']; ?>" value="1" required></label><button type="submit">장바구니 담기</button></fieldset></form></section><?php } ?>
<?php if($bpz_cancelOrder!==null){ ?><section class="bpz-card"><h2>주문 취소 확인</h2><p>주문 <?php echo bpz_theme_escape($bpz_cancelOrder['od_id']); ?> · <?php echo number_format((int)$bpz_cancelOrder['od_receipt_point']); ?> P 반환</p>
<form method="post"><fieldset<?php if(!$bpz_enabled)echo ' disabled'; ?>><?php bpz_action_fields($bpz_csrf,'cancel'); ?><input type="hidden" name="order" value="<?php echo bpz_theme_escape($bpz_cancelOrder['od_id']); ?>"><button type="submit">주문 취소</button></fieldset></form></section><?php } ?>
<section class="bpz-card"><h2>장바구니</h2>
<?php if($bpz_loadError){ ?><p>장바구니 조회 불가</p><?php }elseif(!$bpz_rows){ ?><p>장바구니가 비어 있습니다.</p><?php }else{ $bpz_total=0;foreach($bpz_rows as $bpz_r){$bpz_total+=(int)$bpz_r['ct_price']*(int)$bpz_r['ct_qty']; ?>
<article class="bpz-card"><h3><?php echo bpz_theme_escape($bpz_r['it_name']); ?></h3><p><?php echo number_format((int)$bpz_r['ct_price']); ?> P</p>
<form method="post"><fieldset<?php if(!$bpz_cartEnabled)echo ' disabled'; ?>><?php bpz_action_fields($bpz_csrf,'cart_set'); ?><input type="hidden" name="item" value="<?php echo bpz_theme_escape($bpz_r['it_id']); ?>"><label>수량 <input name="qty" type="number" min="1" value="<?php echo (int)$bpz_r['ct_qty']; ?>" required></label><button type="submit">변경</button></fieldset></form>
<form method="post"><fieldset<?php if(!$bpz_cartEnabled)echo ' disabled'; ?>><?php bpz_action_fields($bpz_csrf,'cart_remove'); ?><input type="hidden" name="item" value="<?php echo bpz_theme_escape($bpz_r['it_id']); ?>"><button type="submit">삭제</button></fieldset></form></article>
<?php } ?><p>예상 결제 포인트 <strong><?php echo number_format($bpz_total); ?> P</strong></p><p>최종 금액은 주문 시 서버에서 확인합니다.</p>
<form method="post"><fieldset<?php if(!$bpz_enabled)echo ' disabled'; ?>><?php bpz_action_fields($bpz_csrf,'purchase'); ?><input type="hidden" name="request_id" value="<?php echo bpz_theme_escape($bpz_request); ?>"><button type="submit">포인트로 구매</button></fieldset></form><?php } ?>
<p><a class="bpz-link" href="<?php echo bpz_theme_escape($bpz_base.'/pointzone.php?section=shop'); ?>">상품 목록</a> · <a class="bpz-link" href="<?php echo bpz_theme_escape($bpz_base.'/pointzone.php?section=my'); ?>">내 주문</a></p></section>
<?php if(($is_admin??'')==='super'){ ?><section class="bpz-card"><h2>결제 확인 대기 주문</h2><p>기존 포인트 기록을 확인한 후 영카트 주문 상태만 완료합니다. 재차감·재지급하지 않습니다.</p>
<form method="post"><fieldset<?php if(!$bpz_enabled)echo ' disabled'; ?>><?php bpz_action_fields($bpz_csrf,'review_pending'); ?><label>회원 ID <input name="target" required></label><label>주문 번호 <input name="order" inputmode="numeric" required></label><button type="submit">거래 기록 확인</button></fieldset></form>
<form method="post"><fieldset<?php if(!$bpz_enabled)echo ' disabled'; ?>><?php bpz_action_fields($bpz_csrf,'finish_pending'); ?><label>회원 ID <input name="target" required></label><label>주문 번호 <input name="order" inputmode="numeric" required></label><label>확인된 포인트 기록 번호 <input name="point_id" inputmode="numeric" required></label><button type="submit">주문 상태 복구</button></fieldset></form></section><?php } ?>
<style>.bpz-card fieldset{border:0;padding:0;margin:10px 0;display:flex;flex-wrap:wrap;align-items:end;gap:8px}.bpz-card fieldset label{display:grid;gap:4px;flex:1;min-width:130px}.bpz-card input,.bpz-card button{border:1px solid var(--line);border-radius:8px;padding:10px;min-height:42px;font:inherit;background:var(--surface);color:var(--ink)}.bpz-card button:disabled,.bpz-card fieldset:disabled{opacity:.6}</style>
<?php require __DIR__.'/shop/shop.tail.php'; ?>
