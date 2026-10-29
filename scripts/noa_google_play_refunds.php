<?php
declare(strict_types=1);
// Run every five minutes under the hosting account. No public HTTP trigger.
if (PHP_SAPI!=='cli') {http_response_code(403);exit;}
$root=getenv('NOA_WEB_ROOT');
if (!$root||!is_file($root.'/common.php')) throw new RuntimeException('NOA_WEB_ROOT_required');
require $root.'/common.php';require $root.'/noa-bridge/google-play-core.php';
$c=ngp_config();if (($c['packageName']??'')!=='kr.ai.noastudio') throw new RuntimeException('play_not_configured');
$page='';$count=0;
do {
    // Replay the full available 30-day window. Refund receipts are idempotent;
    // no watermark can skip a transaction after an interrupted run.
    $r=ngp_api($c,'voidedpurchases?type=0&maxResults=1000'.($page!==''?'&token='.rawurlencode($page):''));
    foreach ($r['voidedPurchases']??[] as $v) {
        if (!is_string($v['purchaseToken']??null)) throw new RuntimeException('invalid_voided_purchase');
        ngp_refund($v['purchaseToken']);$count++;
    }
    $page=$r['tokenPagination']['nextPageToken']??'';
} while ($page!=='');
echo json_encode(['ok'=>true,'checked'=>$count,'completedAt'=>gmdate('c')],JSON_THROW_ON_ERROR)."\n";
