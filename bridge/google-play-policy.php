<?php
declare(strict_types=1);
/** Fixed server-side pack mapping. Prices displayed to buyers come from Play. */
function ngp_products(): array {
    $out=[];
    foreach ([1000,3000,5000,10000,30000,50000] as $p) $out['noa_points_'.$p]=['paidPoints'=>$p,'bonusPoints'=>$p>=10000?intdiv($p,10):0];
    return $out;
}
function ngp_account(string $owner,string $secret): string {
    if ($owner==='' || strlen($secret)<32) throw new DomainException('play_not_configured');
    return hash_hmac('sha256',$owner,$secret);
}
function ngp_validate(array $purchase,string $product,string $account,string $mode): array {
    $pack=ngp_products()[$product]??null;
    if (!$pack) throw new DomainException('invalid_product');
    if (($purchase['purchaseState']??null)!==0) throw new DomainException('purchase_not_completed');
    if (!is_string($purchase['obfuscatedExternalAccountId']??null) || !hash_equals($account,$purchase['obfuscatedExternalAccountId'])) throw new DomainException('purchase_owner_mismatch');
    if (isset($purchase['productId']) && $purchase['productId']!==$product) throw new DomainException('purchase_product_mismatch');
    if (($purchase['quantity']??1)!==1 || (isset($purchase['refundableQuantity']) && $purchase['refundableQuantity']!==1)) throw new DomainException('purchase_quantity_mismatch');
    $test=($purchase['purchaseType']??null)===0;
    if (!in_array($mode,['test','live'],true) || ($mode==='test' && !$test)) throw new DomainException('purchase_mode_mismatch');
    return $pack+['test'=>$test,'totalPoints'=>$pack['paidPoints']+$pack['bonusPoints']];
}
