<?php
require_once dirname(__DIR__,2).'/common.php';
if(empty($is_member)||empty($member['mb_id'])||!empty($member['mb_leave_date'])||!empty($member['mb_intercept_date'])){http_response_code(403);exit;}
header('Cache-Control: private, no-store');
$base=G5_URL.'/theme/Busan_PointZone';
$csrf=get_session('ss_bpz_order_csrf');
if(!is_string($csrf)||!preg_match('/^[a-f0-9]{64}$/D',$csrf)){$csrf=bin2hex(random_bytes(32));set_session('ss_bpz_order_csrf',$csrf);}
$owner=(string)$member['mb_id'];
$cart=get_session('ss_bpz_native_cart');
if(!is_string($cart)||!preg_match('/^[1-9][0-9]{14}$/D',$cart)||get_session('ss_bpz_cart_owner')!==$owner){
    $cart=(string)random_int(100000000000000,999999999999999);
    set_session('ss_bpz_native_cart',$cart);set_session('ss_bpz_cart_owner',$owner);
}
$request=get_session('ss_bpz_purchase_request');
if(!is_string($request)||!preg_match('/^[a-f0-9]{32}$/D',$request)||get_session('ss_bpz_request_cart')!==$cart){
    $request=bin2hex(random_bytes(16));set_session('ss_bpz_purchase_request',$request);set_session('ss_bpz_request_cart',$cart);
}
// Deployment package maps the reviewed engine sources to lib/engine.
// No flag from a client, session or HTTP parameter can open this gate.
$engine=__DIR__.'/lib/engine';
$enabled=false;
if(is_file($engine.'/checkout-readiness.php')){
    require_once $engine.'/checkout-readiness.php';
    try{BusanCheckoutReadiness::liveCheckout();$enabled=true;}catch(Throwable $e){}
}
if(($_SERVER['REQUEST_METHOD']??'GET')==='POST'){
    if(!$enabled){http_response_code(503);exit('현재 포인트 구매 및 주문 변경은 준비 중입니다.');}
    try{
        require_once $engine.'/pointzone-actions.php';
        require_once $engine.'/native-cart.php';
        require_once $engine.'/existing-point-order-store.php';
        $db=new PDO('mysql:host='.G5_MYSQL_HOST.';dbname='.G5_MYSQL_DB.';charset=utf8mb4',G5_MYSQL_USER,G5_MYSQL_PASSWORD,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
        if(G5_MYSQL_DB!=='rucyjeon79')throw new RuntimeException('unexpected database');
        $cartApi=new BusanNativeCart($db);
        $settlement=new BusanPointOrderSettlement(BusanExistingPoints::native(),new BusanExistingPointOrderStore($db));
        $controller=new BusanPointZoneActions(static function($action,$who,$cartId,$p)use($cartApi,$settlement){
            switch($action){
                case 'cart_set':$cartApi->set($who,$cartId,$p['item'],(int)$p['qty']);return ['state'=>'cart_updated'];
                case 'cart_remove':$cartApi->remove($who,$cartId,$p['item']);return ['state'=>'cart_updated'];
                case 'purchase':return $settlement->purchase($who,$cartId,$p['request_id']);
                case 'cancel':return $settlement->cancel($who,$p['order']);
                case 'review_pending':return $settlement->reviewPending($p['target'],$p['order']);
                case 'finish_pending':return $settlement->reviewPending($p['target'],$p['order'],(int)$p['point_id']);
            }
            throw new DomainException('unsupported action');
        });
        $result=$controller->handle(['member'=>$owner,'active'=>true,'super'=>($is_admin??'')==='super'],$csrf,$cart,'POST',$_POST);
        if(($_POST['action']??'')==='purchase'&&($result['state']??'')==='paid'){
            set_session('ss_bpz_native_cart','');set_session('ss_bpz_purchase_request','');
        }
        set_session('ss_bpz_action_result',$result);
        header('Location: '.$base.'/checkout.php',true,303);exit;
    }catch(Throwable $e){set_session('ss_bpz_action_result',['state'=>'check_required']);header('Location: '.$base.'/checkout.php',true,303);exit;}
}
if(($_SERVER['REQUEST_METHOD']??'GET')!=='GET'){http_response_code(405);exit;}
$g5['title']='장바구니 및 포인트 결제';
$rows=[];$loadError=false;
try{
    $q="SELECT it_id,it_name,ct_qty,ct_price FROM yc5_cart WHERE od_id='".sql_real_escape_string($cart)."' AND mb_id='".sql_real_escape_string($owner)."' AND ct_status='쇼핑' ORDER BY ct_id LIMIT 100";
    $rs=sql_query($q,false);if($rs===false)throw new RuntimeException('cart query');
    while($r=sql_fetch_array($rs))$rows[]=$r;
}catch(Throwable $e){$loadError=true;}
$result=get_session('ss_bpz_action_result');set_session('ss_bpz_action_result',null);
require __DIR__.'/shop/shop.head.php';
function bpz_action_fields($csrf,$action){echo '<input type="hidden" name="csrf" value="'.bpz_theme_escape($csrf).'"><input type="hidden" name="action" value="'.bpz_theme_escape($action).'">';}
?>
<section class="bpz-hero"><p class="bpz-kicker">POINT CHECKOUT</p><h1>장바구니 및 포인트 결제</h1><p>기존 보유 포인트로만 결제합니다.</p><div class="bpz-balance"><span>보유 포인트</span><strong><?php echo number_format((int)$member['mb_point']); ?> P</strong></div></section>
<?php if(!$enabled){ ?><section class="bpz-card" role="status">현재 구매·취소 준비 중입니다. 실제 포인트는 차감되지 않습니다.</section><?php } ?>
<?php if(is_array($result)){ ?><section class="bpz-card" role="status"><?php echo bpz_theme_escape(['paid'=>'구매 완료','cancelled'=>'취소 완료','cart_updated'=>'장바구니 변경 완료','check_required'=>'주문 상태를 확인해 주세요. 같은 결제를 다시 실행하지 마세요.'][$result['state']??'']??'거래 상태 확인'); ?>
<?php if(($is_admin??'')==='super'&&isset($result['can_finalize'],$result['order'])){ ?><p>주문 <?php echo bpz_theme_escape($result['order']); ?> · 확인된 포인트 기록 <?php echo bpz_theme_escape($result['point_id']??'없음'); ?></p><?php } ?></section><?php } ?>
<section class="bpz-card"><h2>장바구니</h2>
<?php if($loadError){ ?><p>장바구니 조회 불가</p><?php }elseif(!$rows){ ?><p>장바구니가 비어 있습니다.</p><?php }else{ $total=0;foreach($rows as $r){$total+=(int)$r['ct_price']*(int)$r['ct_qty']; ?>
<article class="bpz-card"><h3><?php echo bpz_theme_escape($r['it_name']); ?></h3><p><?php echo number_format((int)$r['ct_price']); ?> P</p>
<form method="post"><fieldset<?php if(!$enabled)echo ' disabled'; ?>><?php bpz_action_fields($csrf,'cart_set'); ?><input type="hidden" name="item" value="<?php echo bpz_theme_escape($r['it_id']); ?>"><label>수량 <input name="qty" type="number" min="1" value="<?php echo (int)$r['ct_qty']; ?>" required></label><button type="submit">변경</button></fieldset></form>
<form method="post"><fieldset<?php if(!$enabled)echo ' disabled'; ?>><?php bpz_action_fields($csrf,'cart_remove'); ?><input type="hidden" name="item" value="<?php echo bpz_theme_escape($r['it_id']); ?>"><button type="submit">삭제</button></fieldset></form></article>
<?php } ?><p>예상 결제 포인트 <strong><?php echo number_format($total); ?> P</strong></p><p>최종 금액은 주문 시 서버에서 확인합니다.</p>
<form method="post"><fieldset<?php if(!$enabled)echo ' disabled'; ?>><?php bpz_action_fields($csrf,'purchase'); ?><input type="hidden" name="request_id" value="<?php echo bpz_theme_escape($request); ?>"><button type="submit">포인트로 구매</button></fieldset></form><?php } ?>
<p><a class="bpz-link" href="<?php echo bpz_theme_escape($base.'/pointzone.php?section=shop'); ?>">상품 목록</a> · <a class="bpz-link" href="<?php echo bpz_theme_escape($base.'/pointzone.php?section=my'); ?>">내 주문</a></p></section>
<?php if(($is_admin??'')==='super'){ ?><section class="bpz-card"><h2>결제 확인 대기 주문</h2><p>기존 포인트 기록을 확인한 후 영카트 주문 상태만 완료합니다. 재차감·재지급하지 않습니다.</p>
<form method="post"><fieldset<?php if(!$enabled)echo ' disabled'; ?>><?php bpz_action_fields($csrf,'review_pending'); ?><label>회원 ID <input name="target" required></label><label>주문 번호 <input name="order" inputmode="numeric" required></label><button type="submit">거래 기록 확인</button></fieldset></form>
<form method="post"><fieldset<?php if(!$enabled)echo ' disabled'; ?>><?php bpz_action_fields($csrf,'finish_pending'); ?><label>회원 ID <input name="target" required></label><label>주문 번호 <input name="order" inputmode="numeric" required></label><label>확인된 포인트 기록 번호 <input name="point_id" inputmode="numeric" required></label><button type="submit">주문 상태 복구</button></fieldset></form></section><?php } ?>
<style>.bpz-card fieldset{border:0;padding:0;margin:10px 0;display:flex;flex-wrap:wrap;align-items:end;gap:8px}.bpz-card fieldset label{display:grid;gap:4px;flex:1;min-width:130px}.bpz-card input,.bpz-card button{border:1px solid var(--line);border-radius:8px;padding:10px;min-height:42px;font:inherit;background:var(--surface);color:var(--ink)}.bpz-card button:disabled,.bpz-card fieldset:disabled{opacity:.6}</style>
<?php require __DIR__.'/shop/shop.tail.php'; ?>
