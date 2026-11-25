<?php
if(!defined('_GNUBOARD_'))exit;
?>
<?php if(isset($bpz_activityKinds[$bpz_section])){ ?>
<section class="bpz-card">
<h2><?php echo bpz_theme_escape($bpz_activityKinds[$bpz_section]); ?> 목록</h2>
<?php if($bpz_activityError){ ?><p role="status"><?php echo bpz_theme_escape($bpz_activityMessage?:'현재 목록을 조회할 수 없습니다.'); ?></p><?php }elseif(!$bpz_activityRows){ ?><p>현재 등록된 <?php echo bpz_theme_escape($bpz_activityKinds[$bpz_section]); ?>이(가) 없습니다.</p><?php } ?>
<?php foreach($bpz_activityRows as $bpz_ar){ ?>
<article class="bpz-card"><h3><?php echo bpz_theme_escape($bpz_ar['title']); ?></h3><p><?php echo nl2br(bpz_theme_escape($bpz_ar['description'])); ?></p>
<p>기간: <?php echo bpz_theme_escape($bpz_ar['opens_at'].' ~ '.($bpz_ar['closes_at']??'별도 마감 없음')); ?></p>
<p>상태: <?php echo $bpz_ar['state']==='open'?'진행':'종료'; ?></p>
<?php if($bpz_section==='auction'){ ?><p>시작가 <?php echo number_format((int)$bpz_ar['point_amount']); ?> P · 입찰 단위 <?php echo number_format((int)$bpz_ar['step_points']); ?> P</p><p>포인트 입찰은 정산 검증 후 활성화됩니다.</p><?php } ?>
<?php if($bpz_section==='sharing'){ ?><p>참여 기준 <?php echo number_format((int)$bpz_ar['point_amount']); ?> P</p><p>포인트 나눔은 정산 검증 후 활성화됩니다.</p><?php } ?>
<?php if($bpz_section==='events'&&$bpz_ar['state']==='open'&&(int)$bpz_ar['point_amount']===0){ ?>
<form method="post" action="<?php echo bpz_theme_escape($bpz_base.'?section=events'); ?>">
<input type="hidden" name="csrf" value="<?php echo bpz_theme_escape($bpz_activityToken); ?>">
<input type="hidden" name="activity_action" value="join">
<input type="hidden" name="activity_id" value="<?php echo bpz_theme_escape($bpz_ar['id']); ?>">
<input type="hidden" name="request_id" value="<?php echo bin2hex(random_bytes(16)); ?>">
<button type="submit">이벤트 참여</button></form>
<?php } ?>
<?php if($bpz_section==='profile'){ ?><p><?php echo (int)$bpz_ar['duration_days']===0?'영구 소장':number_format((int)$bpz_ar['duration_days']).'일'; ?></p><a class="bpz-link" href="<?php echo bpz_theme_escape(BUSAN_POINTZONE_THEME_URL.'/checkout.php?item='.rawurlencode((string)$bpz_ar['item_id'])); ?>">상품 확인</a><?php } ?>
</article>
<?php } ?>
</section>
<?php } ?>
<?php if(in_array($bpz_section,['profile','my'],true)){ ?>
<section class="bpz-card"><h2>보유 꾸미기 아이템</h2>
<?php if($bpz_activityError){ ?><p>보유 내역을 조회할 수 없습니다.</p><?php }elseif(!$bpz_entitlementRows){ ?><p>보유한 아이템이 없습니다.</p><?php } ?>
<?php foreach($bpz_entitlementRows as $bpz_er){ ?><article class="bpz-card"><h3><?php echo bpz_theme_escape($bpz_er['title']); ?></h3><p><?php echo bpz_theme_escape($bpz_er['expires_at']??'영구 소장'); ?> · <?php echo (int)$bpz_er['active']===1?'사용 가능':'사용 종료'; ?></p></article><?php } ?></section>
<?php } ?>
<?php if($bpz_section==='my'){ ?>
<section class="bpz-card"><h2>나의 입찰·나눔·이벤트 내역</h2>
<?php if($bpz_activityError){ ?><p>참여 내역을 조회할 수 없습니다.</p><?php }elseif(!$bpz_activityHistory){ ?><p>참여 내역이 없습니다.</p><?php } ?>
<?php foreach($bpz_activityHistory as $bpz_hr){ ?><article class="bpz-card"><h3><?php echo bpz_theme_escape($bpz_hr['title']); ?></h3><p><?php echo bpz_theme_escape(($bpz_activityKinds[$bpz_hr['kind']]??'활동').' · '.$bpz_hr['created_at']); ?> · <?php echo number_format((int)$bpz_hr['amount']); ?> P</p><p><?php echo bpz_theme_escape(['submitted'=>'접수','pending'=>'확인 대기','confirmed'=>'참여 완료','rejected'=>'거절','awarded'=>'선정','cancelled'=>'취소'][$bpz_hr['state']]??'확인 필요'); ?></p></article><?php } ?></section>
<?php } ?>
<?php if($bpz_section==='honor'){ ?><section class="bpz-card"><h2>활동 및 기여도 순위</h2><p>공식 집계 기준 확정 후 순위를 표시합니다. 아직 공개된 순위가 없습니다.</p></section><?php } ?>
