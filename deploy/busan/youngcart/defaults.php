<?php
declare(strict_types=1);
// Native Youngcart defaults, not a checkout implementation. Keep all cash
// channels disabled. Empty provider data and no invented company details.
function busan_yc_default_values(): array {
    return [
        'de_shop_skin'=>'Busan_PointZone','de_shop_mobile_skin'=>'Busan_PointZone',
        'de_bank_use'=>0,'de_bank_account'=>'','de_vbank_use'=>'0',
        'de_iche_use'=>0,'de_card_use'=>0,'de_hp_use'=>0,'de_easy_pay_use'=>0,
        'de_easy_pay_services'=>'','de_samsung_pay_use'=>0,'de_inicis_lpay_use'=>0,
        'de_inicis_kakaopay_use'=>0,'de_inicis_cartpoint_use'=>0,
        'de_card_point'=>0,'de_taxsave_use'=>0,'de_escrow_use'=>0,
        'de_guest_cart_use'=>0,'de_pg_service'=>'','de_member_reg_coupon_use'=>0,
        'de_settle_min_point'=>1,'de_settle_max_point'=>2147483647,'de_settle_point_unit'=>1,
        'de_baesong_content'=>'','de_change_content'=>'','de_guest_privacy'=>'',
        'de_sms_cont1'=>'','de_sms_cont2'=>'','de_sms_cont3'=>'','de_sms_cont4'=>'','de_sms_cont5'=>''
    ];
}
