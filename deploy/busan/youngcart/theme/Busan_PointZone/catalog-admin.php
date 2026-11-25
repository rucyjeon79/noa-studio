<?php
require_once dirname(__DIR__,2).'/common.php';
if(empty($is_member)||($is_admin??'')!=='super'||!empty($member['mb_leave_date'])||!empty($member['mb_intercept_date'])){http_response_code(403);exit;}
require __DIR__.'/lib/catalog.php';
$g5['title']='상품·분류·재고 관리';
$csrf=get_session('ss_bpz_catalog_csrf');
if(!is_string($csrf)||!preg_match('/^[a-f0-9]{64}$/D',$csrf)){$csrf=bin2hex(random_bytes(32));set_session('ss_bpz_catalog_csrf',$csrf);}
$error='';$ready=false;$cats=[];$items=[];
try{
    BusanCatalog::ready();$ready=true;
    if(($_SERVER['REQUEST_METHOD']??'')==='POST'){
        $given=$_POST['csrf']??null;$action=$_POST['action']??null;
        if(!is_string($given)||!hash_equals($csrf,$given)||!is_string($action))throw new DomainException('잘못된 요청입니다.');
        BusanCatalog::mutate($action,$_POST);
        set_session('ss_bpz_catalog_csrf',bin2hex(random_bytes(32)));
        header('Location: '.G5_URL.'/theme/Busan_PointZone/catalog-admin.php',true,303);exit;
    }
}catch(DomainException $e){$error=$e->getMessage();}
catch(Throwable $e){$ready=false;$error='상품 관리 시스템을 현재 사용할 수 없습니다.';}
if($ready){try{$cats=BusanCatalog::rows('SELECT ca_id,ca_name FROM yc5_category ORDER BY ca_order,ca_id LIMIT 200');$items=BusanCatalog::rows('SELECT it_id,ca_id,it_name,it_basic,it_price,it_stock_qty,it_use FROM yc5_item ORDER BY it_update_time DESC,it_id LIMIT 200');}catch(Throwable $e){$ready=false;$error='상품 조회 실패';}}
require __DIR__.'/shop/shop.head.php';
function bpz_cf($name,$value,$label,$type='text'){
    echo '<label>'.bpz_theme_escape($label).'<input name="'.bpz_theme_escape($name).'" type="'.bpz_theme_escape($type).'" value="'.bpz_theme_escape($value).'" required></label>';
}
function bpz_cs($cats,$selected=''){
    echo '<label>분류<select name="category" required><option value="">선택</option>';
    foreach($cats as $c)echo '<option value="'.bpz_theme_escape($c['ca_id']).'"'.($selected===$c['ca_id']?' selected':'').'>'.bpz_theme_escape($c['ca_name']).'</option>';
    echo '</select></label>';
}
function bpz_hidden($csrf,$action){echo '<input type="hidden" name="csrf" value="'.bpz_theme_escape($csrf).'"><input type="hidden" name="action" value="'.bpz_theme_escape($action).'">';}
?>
<style>
.bpz-admin-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.bpz-form{display:grid;gap:12px}.bpz-form label{display:grid;gap:4px;font-weight:600}.bpz-form input,.bpz-form select,.bpz-form textarea,.bpz-form button{width:100%;min-width:0;min-height:44px;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);font:inherit}.bpz-form button{background:var(--accent);color:var(--bg);cursor:pointer;font-weight:700}.bpz-form button:disabled{opacity:.5;cursor:not-allowed}.bpz-form textarea{min-height:100px}.bpz-record{border-top:1px solid var(--line);padding-block:12px}.bpz-record summary{cursor:pointer}@media(max-width:760px){.bpz-admin-grid{grid-template-columns:1fr}}
</style>
<section class="bpz-hero"><p class="bpz-kicker">ADMIN · DRAFT CATALOG</p><h1>상품·분류·재고 관리</h1><p>미공개 초안 전용 · 판매 및 결제 잠금</p></section>
<?php if($error!==''){ ?><section class="bpz-card" role="alert"><?php echo bpz_theme_escape($error); ?></section><?php } ?>
<?php if($ready){ ?>
<div class="bpz-admin-grid">
<section class="bpz-card"><h2>분류 초안 등록</h2><form class="bpz-form" method="post"><?php bpz_hidden($csrf,'category_create');bpz_cf('category','','분류 코드 (2자리)');bpz_cf('name','','분류명'); ?><button type="submit">미공개 분류 저장</button></form>
<?php foreach($cats as $c){ ?><p><?php echo bpz_theme_escape($c['ca_id'].' · '.$c['ca_name']); ?></p><?php } ?></section>
<section class="bpz-card"><h2>상품 초안 등록</h2><form class="bpz-form" method="post"><?php bpz_hidden($csrf,'item_create');bpz_cs($cats);bpz_cf('name','','상품명');bpz_cf('price','','가격 (P)','number');bpz_cf('stock','','재고 수량','number'); ?><label>설명<textarea name="description" maxlength="1000"></textarea></label><button type="submit"<?php if(!$cats)echo ' disabled'; ?>>미공개 상품 저장</button></form></section>
</div>
<section class="bpz-card"><h2>상품 및 재고 목록</h2><?php if(!$items){ ?><p>등록된 상품이 없습니다.</p><?php } ?>
<?php foreach($items as $it){ ?><details class="bpz-record"><summary><?php echo bpz_theme_escape($it['it_name']); ?> · <?php echo number_format((int)$it['it_price']); ?> P · 재고 <?php echo number_format((int)$it['it_stock_qty']); ?>개</summary>
<?php if((int)$it['it_use']===0){ ?><form class="bpz-form" method="post"><?php bpz_hidden($csrf,'item_update'); ?><input type="hidden" name="item" value="<?php echo bpz_theme_escape($it['it_id']); ?>"><?php bpz_cs($cats,$it['ca_id']);bpz_cf('name',$it['it_name'],'상품명');bpz_cf('price',$it['it_price'],'가격 (P)','number');bpz_cf('stock',$it['it_stock_qty'],'재고 수량','number'); ?><label>설명<textarea name="description" maxlength="1000"><?php echo bpz_theme_escape($it['it_basic']); ?></textarea></label><button type="submit">미공개 상품 수정</button></form><?php }else{ ?><p>판매 공개 상태는 수정할 수 없습니다.</p><?php } ?></details><?php } ?></section>
<?php } ?>
<section class="bpz-card"><a class="bpz-link" href="<?php echo bpz_theme_escape(BUSAN_POINTZONE_THEME_URL.'/pointzone.php?section=manage'); ?>">통합 운영센터 돌아가기</a></section>
<?php require __DIR__.'/shop/shop.tail.php'; ?>
