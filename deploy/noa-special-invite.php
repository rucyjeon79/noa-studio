<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
require_once __DIR__.'/noa-bridge/special-invite.php';
header('Cache-Control: private, no-store');header('Referrer-Policy: no-referrer');header('X-Robots-Tag: noindex, nofollow');
$title='람준파파의 특별한 별무리 초대장';
$csrf=$_SESSION['noa_invite_csrf']??=bin2hex(random_bytes(32));
$owner=(string)($member['mb_id']??'');
$pending=(string)($_COOKIE['__Host-noa_invite']??'');
$resume=isset($_GET['resume']);
$token=(string)($_POST['token']??($resume?$pending:($_GET['t']??'')));
$message='';$share='';$canAccept=false;
function ni_cookie(string $value,int $expires):void{
    setcookie('__Host-noa_invite',$value,['expires'=>$expires,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);
}
function ni_html(string $value):string{return htmlspecialchars($value,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
try{
    if($_SERVER['REQUEST_METHOD']==='POST'){
        if(!hash_equals($csrf,(string)($_POST['csrf']??''))||($_SERVER['HTTP_ORIGIN']??'')!=='https://noastudio.ai.kr')throw new DomainException('invite_forbidden');
        if(($_POST['action']??'')==='issue'){
            if(($is_admin??'')!=='super'||!ng_unlimited($owner))throw new DomainException('invite_forbidden');
            $request=(string)($_POST['request']??'');
            if(!preg_match('/^[a-f0-9]{32}$/D',$request))throw new DomainException('invite_invalid');
            $secret=$_SESSION['noa_invite_key']??=bin2hex(random_bytes(32));
            $token=hash_hmac('sha256',$request,$secret);
            ni_issue($owner,$token,time());
            $share='https://noastudio.ai.kr/noa-special-invite.php?t='.$token;
            if(($_SERVER['HTTP_ACCEPT']??'')==='application/json'){
                header('Content-Type: application/json');echo json_encode(['url'=>$share],JSON_THROW_ON_ERROR);exit;
            }
        }elseif(($_POST['action']??'')==='accept'){
            if($owner===''){
                $r=ns_doc(ni_key($token));
                if(!$r||$r['data']['claimedBy']!==null)throw new DomainException('invite_taken');
                ni_cookie($token,time()+86400);
                header('Location: /noa-login.php?url='.rawurlencode('/noa-special-invite.php?resume=1'),true,303);exit;
            }
            ni_claim($owner,$token,time());ni_cookie('',time()-3600);
            header('Location: /noa-gifts.php?box=received',true,303);exit;
        }else throw new DomainException('invite_invalid');
    }else{
        $r=ns_doc(ni_key($token));
        if(!$r)throw new DomainException('invite_invalid');
        if($r['data']['claimedBy']!==null){
            if($owner!==''&&$r['data']['claimedBy']===$owner){ni_cookie('',time()-3600);header('Location: /noa-gifts.php?box=received');exit;}
            throw new DomainException('invite_taken');
        }
        $canAccept=true;
    }
}catch(DomainException $e){
    if($resume||$pending===$token)ni_cookie('',time()-3600);
    $message=match($e->getMessage()){'invite_taken'=>'이미 수령한 초대장입니다.','invite_forbidden'=>'권한을 확인해 주세요.','invite_self'=>'다른 분께 전달할 초대장입니다.',default=>'이 초대장을 사용할 수 없습니다.'};
    http_response_code($e->getMessage()==='invite_forbidden'?403:409);
}catch(Throwable $e){http_response_code(503);$message='초대장 처리 중입니다. 잠시 후 다시 열어 주세요.';}
?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title><?=ni_html($title)?></title><meta property="og:type" content="website">
<meta property="og:title" content="<?=ni_html($title)?>">
<meta property="og:description" content="람준파파가 별무리 VIP 30일 이용권을 선물합니다.">
<meta property="og:image" content="https://noastudio.ai.kr/noa-special-invite.jpg">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="금빛 별 하나로 봉인한 람준파파의 특별한 별무리 초대장">
<link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-gifts.css?v=<?=hash_file('sha256',__DIR__.'/noa-gifts.css')?>"></head><body class="noa-page"><main class="noa-special-letter"><p class="noa-eyebrow">NOA STUDIO · INVITATION</p><h1><?=ni_html($title)?></h1><p>별무리 VIP 30일 이용권</p>
<?php if($message):?><p role="status"><?=ni_html($message)?></p>
<?php elseif($share):?><p>한 분만 받을 수 있는 초대장이 준비됐어요.</p><a class="noa-button" href="sms:?body=<?=rawurlencode($title."\n".$share)?>">메시지로 보내기</a><label>초대 링크 <input readonly value="<?=ni_html($share)?>" onclick="this.select()"></label>
<?php elseif($canAccept):?><p>초대장 한 장으로 한 분을 모십니다. 받은 선물함에서 이용권을 사용한 날부터 VIP 기간이 시작돼요.</p>
<form method="post" id="invite-accept"><input type="hidden" name="action" value="accept"><input type="hidden" name="token" value="<?=ni_html($token)?>"><input type="hidden" name="csrf" value="<?=ni_html($csrf)?>"><button class="noa-button primary">초대장 받기</button></form>
<?php if($owner===''):?><p>회원은 로그인, 처음 오신 분은 가입 후 로그인하면 선물함에 담깁니다.</p><?php endif;?>
<?php if($resume&&$owner!==''&&$pending!==''):?><script>document.getElementById('invite-accept').requestSubmit()</script><?php endif;endif;?></main></body></html>
