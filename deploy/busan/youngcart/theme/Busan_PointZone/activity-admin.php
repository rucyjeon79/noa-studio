<?php
require_once dirname(__DIR__,2).'/common.php';
if(empty($is_member)||($is_admin??'')!=='super'||!empty($member['mb_leave_date'])||!empty($member['mb_intercept_date'])){http_response_code(403);exit;}
require_once __DIR__.'/lib/activities-bridge.php';
$g5['title']='POINT ZONE 활동 운영센터';
$bpz_kinds=['auction'=>'포인트 경매','sharing'=>'포인트 나눔','events'=>'지부장 이벤트','profile'=>'프로필 꾸미기'];
$bpz_kind=$_GET['kind']??'events';
if(!is_string($bpz_kind)||!isset($bpz_kinds[$bpz_kind])){http_response_code(404);exit;}
$bpz_financialEnabled=false;$bpz_token=BusanActivitiesBridge::csrf();$bpz_rows=[];$bpz_error='';$bpz_ready=false;$bpz_edit=null;$bpz_people=[];
$bpz_url=G5_URL.'/theme/Busan_PointZone/activity-admin.php?kind='.$bpz_kind;
try{
    $bpz_api=BusanActivitiesBridge::open();$bpz_financialEnabled=BusanActivitiesBridge::financialEnabled();
    $bpz_rows=$bpz_api->list($bpz_kind,true);$bpz_ready=true;
    if(($_SERVER['REQUEST_METHOD']??'GET')==='POST'){
        BusanActivitiesBridge::verify($_POST,$bpz_token);
        $bpz_action=$_POST['activity_action']??'';
        $bpz_id=$_POST['activity_id']??'';
        if(!is_string($bpz_id))throw new DomainException('invalid activity');
        if($bpz_id!==''){
            $bpz_found=false;foreach($bpz_rows as $bpz_row)if($bpz_row['id']===$bpz_id)$bpz_found=true;
            if(!$bpz_found)throw new DomainException('invalid activity');
        }
        if($bpz_action==='save')$bpz_api->saveDraft(BusanActivitiesBridge::draft($_POST,$bpz_kind),$bpz_id===''?null:$bpz_id);
        elseif($bpz_action==='publish'&&$bpz_id!==''){
            if($bpz_financialEnabled)BusanActivitiesBridge::settlement()->publish($bpz_id);else $bpz_api->publish($bpz_id);
        }elseif($bpz_action==='close'&&$bpz_id!==''){
            if($bpz_financialEnabled){
                $bpz_s=BusanActivitiesBridge::settlement();
                if($bpz_kind==='auction')$bpz_s->closeAuction($bpz_id);else $bpz_s->close($bpz_id);
            }else $bpz_api->close($bpz_id);
        }elseif(in_array($bpz_action,['award','recover'],true)&&$bpz_id!==''){
            if(!$bpz_financialEnabled){http_response_code(503);throw new DomainException('정산 잠금');}
            $bpz_participant=BusanActivitiesBridge::stringField($_POST,'participant_id');
            $bpz_personFound=false;foreach($bpz_api->participants($bpz_id) as $bpz_p)if($bpz_p['id']===$bpz_participant)$bpz_personFound=true;
            if(!$bpz_personFound)throw new DomainException('participant mismatch');
            $bpz_s=BusanActivitiesBridge::settlement();
            if($bpz_action==='award'&&$bpz_kind==='events')$bpz_s->awardEvent($bpz_id,$bpz_participant);
            elseif($bpz_action==='recover')$bpz_s->recover($bpz_participant,BusanActivitiesBridge::amount($_POST,'point_id'));
            else throw new DomainException('invalid action');
        }
        else throw new DomainException('invalid action');
        header('Location: '.$bpz_url,true,303);exit;
    }
    $bpz_selected=$_GET['edit']??'';
    foreach($bpz_rows as $bpz_row)if($bpz_row['id']===$bpz_selected){$bpz_edit=$bpz_row;$bpz_people=$bpz_api->participants($bpz_selected);break;}
}catch(DomainException $e){$bpz_error='입력값 또는 실행 조건을 확인해 주세요.';}
catch(Throwable $e){$bpz_ready=false;$bpz_error='활동 관리 데이터베이스를 사용할 수 없습니다.';}
require __DIR__.'/shop/shop.head.php';
function bpz_activity_hidden($token,$action,$id=''){
    echo '<input type="hidden" name="csrf" value="'.bpz_theme_escape($token).'"><input type="hidden" name="activity_action" value="'.bpz_theme_escape($action).'"><input type="hidden" name="activity_id" value="'.bpz_theme_escape($id).'">';
}
function bpz_activity_field($name,$label,$value,$type='text',$required=true){
    echo '<label>'.bpz_theme_escape($label).'<input type="'.bpz_theme_escape($type).'" name="'.bpz_theme_escape($name).'" value="'.bpz_theme_escape($value).'"'.($required?' required':'').($type==='number'?' min="0" max="2147483647"':'').'></label>';
}
?>
<section class="bpz-hero"><p class="bpz-kicker">ADMIN · ACTIVITIES</p><h1>활동 운영센터</h1><p>실제 활동 등록 및 설정 · 포인트 정산은 별도 검증 필요</p></section>
<nav class="bpz-menu" aria-label="활동 관리"><?php foreach($bpz_kinds as $bpz_key=>$bpz_label){ ?><a class="bpz-menu-item" href="<?php echo bpz_theme_escape(G5_URL.'/theme/Busan_PointZone/activity-admin.php?kind='.$bpz_key); ?>"<?php if($bpz_kind===$bpz_key)echo ' aria-current="page"'; ?>><?php echo bpz_theme_escape($bpz_label); ?></a><?php } ?></nav>
<?php if($bpz_error!==''){ ?><section class="bpz-card" role="alert"><?php echo bpz_theme_escape($bpz_error); ?></section><?php } ?>
<?php if($bpz_ready&&($bpz_edit===null||$bpz_edit['state']==='draft')){ ?>
<section class="bpz-card"><h2><?php echo bpz_theme_escape($bpz_kinds[$bpz_kind]); ?> <?php echo $bpz_edit===null?'등록':'수정'; ?></h2>
<form class="bpz-activity-form" method="post" action="<?php echo bpz_theme_escape($bpz_url); ?>">
<?php bpz_activity_hidden($bpz_token,'save',$bpz_edit['id']??'');bpz_activity_field('title','제목',$bpz_edit['title']??''); ?>
<label>설명<textarea name="description" maxlength="4000"><?php echo bpz_theme_escape($bpz_edit['description']??''); ?></textarea></label>
<?php bpz_activity_field('opens_at','시작 일시',str_replace(' ','T',substr($bpz_edit['opens_at']??'',0,16)),'datetime-local');bpz_activity_field('closes_at','마감 일시',str_replace(' ','T',substr($bpz_edit['closes_at']??'',0,16)),'datetime-local',$bpz_kind==='auction'); ?>
<?php if($bpz_kind!=='profile')bpz_activity_field('point_amount',$bpz_kind==='auction'?'시작 포인트':($bpz_kind==='sharing'?'참여 포인트':'포상 포인트 (0=무료 참여)'),$bpz_edit['point_amount']??0,'number'); ?>
<?php if($bpz_kind==='auction')bpz_activity_field('step_points','최소 입찰 단위',$bpz_edit['step_points']??0,'number'); ?>
<?php bpz_activity_field('capacity','정원 (0=제한 없음)',$bpz_edit['capacity']??0,'number'); ?>
<?php if($bpz_kind==='profile'){bpz_activity_field('item_id','영카트 상품 ID',$bpz_edit['item_id']??'');bpz_activity_field('duration_days','소장 일수 (0=영구)',$bpz_edit['duration_days']??0,'number');} ?>
<button type="submit">초안 저장</button></form></section>
<?php } ?>
<?php if($bpz_ready){ ?><section class="bpz-card"><h2>등록 내역</h2>
<?php if(!$bpz_rows){ ?><p>등록된 활동이 없습니다.</p><?php } ?>
<?php foreach($bpz_rows as $bpz_row){ ?><article class="bpz-card"><h3><?php echo bpz_theme_escape($bpz_row['title']); ?></h3><p><?php echo bpz_theme_escape(['draft'=>'초안','open'=>'진행','closed'=>'마감','cancelled'=>'취소'][$bpz_row['state']]??'확인 필요'); ?></p>
<a class="bpz-link" href="<?php echo bpz_theme_escape($bpz_url.'&edit='.$bpz_row['id']); ?>">상세 및 참여자 확인</a>
<?php if(in_array($bpz_row['state'],['draft','open'],true)){ ?><form method="post" action="<?php echo bpz_theme_escape($bpz_url); ?>"><?php bpz_activity_hidden($bpz_token,$bpz_row['state']==='draft'?'publish':'close',$bpz_row['id']); ?><button type="submit"<?php if(!$bpz_financialEnabled&&!($bpz_row['kind']==='events'&&(int)$bpz_row['point_amount']===0))echo ' disabled'; ?>><?php echo $bpz_row['state']==='draft'?'공개':($bpz_kind==='auction'?'마감 및 낙찰':'마감'); ?></button></form><?php } ?></article><?php } ?></section>
<?php if($bpz_edit!==null){ ?><section class="bpz-card"><h2>참여자</h2><?php if(!$bpz_people){ ?><p>참여자가 없습니다.</p><?php } ?><?php foreach($bpz_people as $bpz_person){ ?><p><?php echo bpz_theme_escape($bpz_person['mb_id'].' · '.$bpz_person['state'].' · '.$bpz_person['created_at']); ?></p><?php if(($bpz_kind==='events'&&$bpz_person['state']==='confirmed'&&(int)$bpz_edit['point_amount']>0)||$bpz_person['state']==='pending'){ ?><form method="post" action="<?php echo bpz_theme_escape($bpz_url); ?>"><?php bpz_activity_hidden($bpz_token,$bpz_person['state']==='pending'?'recover':'award',$bpz_edit['id']); ?><input type="hidden" name="participant_id" value="<?php echo bpz_theme_escape($bpz_person['id']); ?>"><fieldset<?php if(!$bpz_financialEnabled)echo ' disabled'; ?>><?php if($bpz_person['state']==='pending'){ ?><label>검증된 원장 거래번호<input type="number" name="point_id" min="1" required></label><?php } ?><button type="submit"><?php echo $bpz_person['state']==='pending'?'원장 확인 후 복구':'포상 지급'; ?></button></fieldset></form><?php } ?><?php } ?></section><?php } ?>
<?php } ?>
<section class="bpz-card"><a class="bpz-link" href="<?php echo bpz_theme_escape(G5_URL.'/theme/Busan_PointZone/pointzone.php?section=manage'); ?>">통합 운영센터</a></section>
<style>#busan-pointzone .bpz-activity-form{display:grid;gap:12px}#busan-pointzone .bpz-activity-form label{display:grid;gap:4px}#busan-pointzone .bpz-activity-form :is(input,textarea,button){width:100%;min-height:44px;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink)}</style>
<?php require __DIR__.'/shop/shop.tail.php'; ?>
