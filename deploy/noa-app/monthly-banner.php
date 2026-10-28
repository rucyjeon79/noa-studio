<?php
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
if(!function_exists('nmb_rules')||!nmb_rules())return;
?>
<style>
html body .noa-monthly-benefits{margin:16px 0 28px;padding:20px;border:1px solid #c9a35f55;border-radius:16px;background:linear-gradient(115deg,#c9a35f16,transparent 65%),var(--noa-surface,#1d2128);color:var(--noa-text,#f4f3ef);box-sizing:border-box}
html body .noa-monthly-top{display:flex;align-items:center;justify-content:space-between;gap:16px}
html body .noa-monthly-top>div{min-width:0}
html body .noa-monthly-benefits .noa-monthly-eyebrow{display:block;margin:0 0 6px;color:var(--noa-accent,#d8bc7c);font-size:11px;letter-spacing:.08em;line-height:1.4}
html body .noa-monthly-benefits h2{margin:0;font-size:clamp(18px,2.4vw,26px);line-height:1.4;letter-spacing:-.02em;word-break:keep-all}
html body .noa-monthly-badge{flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-width:164px;padding:14px 20px;border:1px solid #f4dfac;border-radius:12px;background:linear-gradient(125deg,#f7e5b7 0%,#dfbd71 58%,#c99a47 100%);color:#302313;box-shadow:inset 0 0 0 3px #fff5dc40,0 4px 16px #00000014;box-sizing:border-box}
html body .noa-monthly-badge span{font-size:12px;font-weight:600;line-height:1.4;letter-spacing:0;white-space:nowrap}
html body .noa-monthly-badge strong{font-size:24px;font-weight:800;line-height:1.25;letter-spacing:-.02em;white-space:nowrap}
html body .noa-monthly-rewards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:20px 0 12px;padding:0;list-style:none}
html body .noa-monthly-rewards li{min-width:0;padding:0 0 0 12px;border-left:1px solid #c9a35f55;display:flex;flex-direction:column;gap:4px}
html body .noa-monthly-rewards span{color:var(--noa-muted,#b9bdc5);font-size:12px;line-height:1.4}
html body .noa-monthly-rewards strong{font-size:18px;font-weight:600;line-height:1.35;letter-spacing:0;font-variant-numeric:tabular-nums}
html body .noa-monthly-benefits .noa-monthly-note{margin:0;color:var(--noa-muted,#b9bdc5);font-size:11px;line-height:1.6;word-break:keep-all}
@media(max-width:600px){html body .noa-monthly-top{flex-direction:column;align-items:stretch;gap:12px}html body .noa-monthly-badge{flex-direction:row;justify-content:space-between;gap:12px;min-width:0;padding:12px 16px}html body .noa-monthly-badge strong{font-size:22px}}
@media(max-width:480px){html body .noa-monthly-benefits{padding:16px}html body .noa-monthly-rewards{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 12px;margin-top:16px}}
</style>
<section class="noa-monthly-benefits" data-home-section="monthly-benefits" aria-labelledby="noa-monthly-heading">
 <div class="noa-monthly-top"><div><span class="noa-monthly-eyebrow">NOA MONTHLY BENEFITS</span><h2 id="noa-monthly-heading">매월 쏟아지는 10배의 혜택.</h2></div><div class="noa-monthly-badge"><span>매월 첫 활동</span><strong>포인트 10배</strong></div></div>
 <ul class="noa-monthly-rewards"><li><span>첫 로그인</span><strong>1,000P</strong></li><li><span>첫 글</span><strong>500P</strong></li><li><span>첫 댓글</span><strong>300P</strong></li><li><span>첫 좋아요</span><strong>100P</strong></li></ul>
 <p class="noa-monthly-note">매월 1일, 한국 시간 기준으로 새롭게. 회원별 각 활동 1회에 기본 적립의 총 10배를 드려요. 이미 적립한 좋아요의 취소·재선택은 제외돼요.</p>
</section>
