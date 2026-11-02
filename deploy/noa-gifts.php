<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
require_once __DIR__.'/noa-bridge/gift-core.php';
require_once __DIR__.'/noa-bridge/toss-core.php';
header('Cache-Control: private, no-store');
header('Referrer-Policy: same-origin');
$owner=(string)($member['mb_id']??'');
if($owner===''||(int)($member['mb_level']??0)<2){
    header('Location: /noa-login.php?url='.rawurlencode('/noa-gifts.php?'.http_build_query(array_intersect_key($_GET,array_flip(['box','product'])))));exit;
}
function gh($value):string{return htmlspecialchars((string)$value,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
function gd(int $time):string{return (new DateTimeImmutable('@'.$time))->setTimezone(new DateTimeZone('Asia/Seoul'))->format('Y.m.d H:i');}
function gift_id():string{$b=random_bytes(16);$b[6]=chr(ord($b[6])&15|64);$b[8]=chr(ord($b[8])&63|128);return vsprintf('%s%s-%s-%s-%s-%s%s%s',str_split(bin2hex($b),4));}
$csrf=$_SESSION['noa_gift_csrf']??=bin2hex(random_bytes(32));
$box=($_GET['box']??'')==='sent'?'sent':'received';
$product=(string)($_GET['product']??'');$point=null;$vip=null;$error='';$payment=null;$users=[];$gifts=[];$next=false;
$page=max(1,min(1000000,(int)($_GET['page']??1)));$query=trim((string)($_GET['q']??''));$now=time();
$id=$_SERVER['REQUEST_METHOD']==='POST'?(string)($_POST['id']??''):gift_id();
try{
    if($product!==''){
        $vip=nv_products()[$product]??null;
        if(!$vip)$point=nt_quote($product);
    }
    if($_SERVER['REQUEST_METHOD']==='POST'){
        if(!hash_equals($csrf,(string)($_POST['csrf']??''))||($_SERVER['HTTP_ORIGIN']??'')!=='https://noastudio.ai.kr')throw new DomainException('csrf_required');
        $action=(string)($_POST['action']??'');
        if($action==='send'&&($point||$vip)){
            $to=(string)($_POST['recipient']??'');
            if($vip){ng_buy_vip($owner,$id,$product,$to,$now);header('Location: /noa-gifts.php?box=sent&done=sent',true,303);exit;}
            $order=nt_create($owner,$id,$product,$now,$to);
            $conf=nt_config();
            $payment=['client'=>$conf['clientKey'],'customer'=>$order['customerKey'],'orderId'=>$order['orderId'],'id'=>$order['id'],'amount'=>$order['priceWon'],'test'=>$order['mode']==='test','recipient'=>$order['giftRecipient']];
        }elseif(in_array($action,['use','extend'],true)){
            ng_update($owner,$id,$action,(int)($_POST['expiry']??0),$now);
            header('Location: /noa-gifts.php?box=received&done='.$action,true,303);exit;
        }else throw new InvalidArgumentException('invalid_action');
    }
    if($product!==''&&$query!==''){
        if(mb_strlen($query)<2||mb_strlen($query)>60)throw new InvalidArgumentException('search_length');
        // Literal prefix search. Wildcards supplied by the member have no special meaning.
        $pattern=ns_e(strtr($query,['!'=>'!!','%'=>'!%','_'=>'!_']).'%');
        $q=ns_q('SELECT mb_id,mb_nick FROM '.ns_table('member_table')." WHERE mb_id<>".ns_e($owner)." AND mb_level>=2 AND COALESCE(mb_leave_date,'')='' AND COALESCE(mb_intercept_date,'')='' AND (mb_nick LIKE $pattern ESCAPE '!' OR mb_id=".ns_e($query).') ORDER BY mb_nick,mb_id LIMIT 15');
        while($u=sql_fetch_array($q))$users[]=$u;
    }
    if($product===''){
        $gifts=ng_list($owner,$box,$page,$now);
        if(count($gifts)>20){array_pop($gifts);$next=true;}
    }
}catch(Throwable $e){
    $errors=['search_length'=>'닉네임 또는 아이디를 두 글자 이상 입력해 주세요.','recipient_unavailable'=>'선택한 회원에게 보낼 수 없습니다.','recipient_plan'=>'받는 회원의 등급과 이용권 종류가 맞지 않습니다.','self_gift'=>'다른 회원을 선택해 주세요.','insufficient_points'=>'보유 포인트가 부족합니다.','membership_not_ready'=>'현재 이용권 판매 준비 중입니다.','payment_not_ready'=>'현재 포인트권 결제 준비 중입니다.','gift_unavailable'=>'이미 사용·취소되었거나 만료된 선물입니다.','gift_changed'=>'유효기간이 이미 변경되었습니다. 선물함을 다시 확인해 주세요.','purchase_conflict'=>'이전 주문과 선택한 상품 또는 회원이 다릅니다. 상품을 다시 선택해 주세요.','csrf_required'=>'페이지를 다시 열어 주세요.','invalid_product'=>'존재하지 않는 상품입니다.','gift_not_found'=>'선물을 찾을 수 없습니다.'];
    http_response_code(match($e->getMessage()){'csrf_required'=>403,'gift_not_found'=>404,'search_length','invalid_product'=>400,default=>isset($errors[$e->getMessage()])?409:503});
    $error=$errors[$e->getMessage()]??'요청을 처리하지 못했습니다. 선물함에서 처리 결과를 확인해 주세요.';
    if(!isset($errors[$e->getMessage()]))error_log('[noa-gifts] '.get_class($e));
}
$labels=['available'=>'미사용','used'=>'사용 완료','expired'=>'기간 만료','canceled'=>'결제 취소'];
?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>선물함 | NOA STUDIO</title><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-gifts.css"><script defer src="/noa-ui.js"></script></head><body class="noa-page"><main class="noa-gifts"><p class="noa-eyebrow">MY · GIFTS</p><h1><?= $product?'선물하기':($box==='sent'?'보낸 선물함':'받은 선물함') ?></h1>
<nav aria-label="선물함"><a href="/noa-gifts.php?box=received">받은 선물함</a><a href="/noa-gifts.php?box=sent">보낸 선물함</a><a href="/noa-my.php">MY</a></nav>
<?php if($error):?><p role="alert"><?=gh($error)?></p><?php endif;?>
<?php if(isset($_GET['done'])):?><p role="status"><?=gh(['sent'=>'선물을 보냈습니다.','use'=>'선물을 사용했습니다.','extend'=>'유효기간을 1년 연장했습니다.'][$_GET['done']]??'')?></p><?php endif;?>
<?php if($vip||$point):?><section><h2><?=gh($vip['name']??(number_format($point['totalPoints']).'P 충전권'))?></h2>
<p><?=gh($vip?number_format($vip['points']).'P 차감 · 사용 시 '.$vip['durationDays'].'일 적용':number_format($point['priceWon']).'원 결제 · 사용 시 '.number_format($point['totalPoints']).'P 지급')?></p><p>발송일부터 1년 안에 사용할 수 있어요. 받는 분이 만료 전에 1년씩 연장할 수 있습니다.</p>
<?php if(!$payment):?><form method="get"><input type="hidden" name="product" value="<?=gh($product)?>"><label>받는 회원 검색 <input name="q" value="<?=gh($query)?>" minlength="2" maxlength="60" required placeholder="닉네임 또는 아이디"></label><button>검색</button></form>
<?php if($users):?><form method="post"><input type="hidden" name="csrf" value="<?=gh($csrf)?>"><input type="hidden" name="id" value="<?=gh($id)?>"><input type="hidden" name="action" value="send"><fieldset><legend>받는 회원 선택</legend><?php foreach($users as $u):?><label><input type="radio" name="recipient" required value="<?=gh($u['mb_id'])?>"> <?=gh($u['mb_nick'])?> <small><?=gh($u['mb_id'])?></small></label><?php endforeach;?></fieldset><button class="noa-button"><?=gh($vip?number_format($vip['points']).'P로 구매해 선물 보내기':'선물 결제 진행')?></button></form><?php elseif($query!==''&&!$error):?><p>검색 결과가 없습니다.</p><?php endif;?>
<?php else:?><p><?=gh($payment['recipient'])?> 회원에게 보낼 선물입니다. <?= $payment['test']?'테스트 결제에서는 선물이 발급되지 않습니다.':'' ?></p><button id="gift-pay">카드로 <?=number_format($payment['amount'])?>원 결제</button><p id="pay-message" role="status"></p><script src="https://js.tosspayments.com/v2/standard"></script>
<script>const gift=<?=json_encode($payment,JSON_HEX_TAG|JSON_HEX_QUOT|JSON_HEX_APOS|JSON_HEX_AMP)?>;document.getElementById('gift-pay').onclick=async function(){this.disabled=true;try{await TossPayments(gift.client).payment({customerKey:gift.customer}).requestPayment({method:'CARD',amount:{currency:'KRW',value:gift.amount},orderId:gift.orderId,orderName:'NOA 포인트 충전권 선물',successUrl:location.origin+'/noa-points.php?result=success&id='+gift.id,failUrl:location.origin+'/noa-points.php?result=fail'});}catch{document.getElementById('pay-message').textContent='결제가 완료되지 않았습니다. 다시 시도할 수 있어요.';}finally{this.disabled=false;}};</script><?php endif;?></section>
<?php elseif($product===''):?><p><?= $box==='sent'?'만료된 선물도 발송 기록에서 언제든지 확인할 수 있어요.':'선물은 원할 때 사용하세요. 미사용 선물은 만료 한 달 전에 알려드리며, 만료 전까지 1년씩 연장할 수 있어요.' ?></p>
<?php if(!$gifts&&!$error):?><p>아직 표시할 선물이 없습니다.</p><?php endif;?>
<?php foreach($gifts as $g):$status=ng_status($g,$now);?><article><h2><?=gh($g['name'])?></h2><strong><?=gh($labels[$status])?></strong>
<p><?= $box==='sent'?'받는 회원':'보낸 회원' ?> · <?=gh($g[$box==='sent'?'recipient':'sender'])?></p>
<p><?=gh($g['kind']==='points'?number_format($g['points']).'P':$g['days'].'일 이용권')?> · 발송 <?=gd($g['sentAt'])?></p><p>사용 유효기간 <?=gd($g['expiresAt'])?>까지</p>
<?php if($g['usedAt']!==null):?><p>사용일 <?=gd($g['usedAt'])?></p><?php elseif($box==='received'&&$status==='available'):?>
<form method="post"><input type="hidden" name="id" value="<?=gh($g['id'])?>"><input type="hidden" name="csrf" value="<?=gh($csrf)?>"><input type="hidden" name="expiry" value="<?=gh($g['expiresAt'])?>"><button name="action" value="use">지금 사용</button><button name="action" value="extend">1년 연장</button></form><?php endif;?></article><?php endforeach;?>
<nav><?php if($page>1):?><a href="?box=<?=$box?>&amp;page=<?=$page-1?>">이전</a><?php endif;?><?php if($next):?><a href="?box=<?=$box?>&amp;page=<?=$page+1?>">다음</a><?php endif;?></nav><?php endif;?></main></body></html>
