<?php
declare(strict_types=1);require __DIR__.'/../../bridge/subscription-core.php';require __DIR__.'/../../bridge/member-access.php';
function check($v,$m){if(!$v)throw new RuntimeException($m);}
function denied(callable $f,string $code){try{$f();throw new RuntimeException('expected_'.$code);}catch(DomainException|InvalidArgumentException $e){check($e->getMessage()===$code,'error_'.$e->getMessage());}}
$p=ns_defaults();check(!$p['enabled']&&$p['plans']['vip']['priceWon']===null&&$p['plans']['creator']['points']===null,'no_invented_price');denied(fn()=>ns_quote($p,'vip','points',3),'subscription_not_configured');
$p['enabled']=true;$p['pointsEnabled']=true;foreach($p['plans']as &$plan)$plan=['enabled'=>true,'priceWon'=>2000,'points'=>10];unset($plan);check(ns_policy_validate($p)===$p,'valid_policy');
foreach([1,2,5,6,7,8,9,10]as $level)denied(fn()=>ns_quote($p,'vip','points',$level),'regular_or_creator_required');foreach([3,4]as $level)check(ns_quote($p,'vip','points',$level)['points']===10,'regular_plan');foreach([7,8]as $level)check(ns_quote($p,'creator','points',$level)['plan']==='creator','creator_plan');
$bad=$p;$bad['plans']['vip']['points']=0;denied(fn()=>ns_policy_validate($bad),'positive_price_required');$bad=$p;$bad['plans']['vip']['points']=null;denied(fn()=>ns_policy_validate($bad),'points_price_required');
$bad=$p;$bad['paymentApprovalEnabled']=true;denied(fn()=>ns_policy_validate($bad),'payment_settings_required');
function epoch(string $s):int{return (new DateTimeImmutable($s,new DateTimeZone('Asia/Seoul')))->getTimestamp();}
check(ns_month_end(epoch('2026-01-31 00:30:00'))===epoch('2026-02-28 00:30:00'),'KST_month_clamp');check(ns_month_end(epoch('2028-01-31 15:20:00'))===epoch('2028-02-29 15:20:00'),'leap_year');check(ns_month_end(epoch('2026-02-28 00:30:00'),31)===epoch('2026-03-31 00:30:00'),'renewal_anchor');
$now=epoch('2026-10-26 12:00:00');foreach([3=>4,7=>8]as $base=>$paid){$g=['ownerId'=>'a','baseLevel'=>$base,'status'=>'active','until'=>$now+1];check(ns_effective_level($base,$g,$now)===$paid,'active');check(ns_effective_level($paid,$g,$now+1)===$base,'expiry_exact_boundary');check(!nam_access(['mb_id'=>'a','mb_level'=>ns_effective_level($paid,$g,$now+1)])['music'],'expired_audio_denied');foreach([1,2,5,10]as $raw)check(ns_effective_level($raw,$g,$now)===$raw,'staff_and_temporary_preserved');$g['status']='revoked';check(ns_effective_level($paid,$g,$now)===$base,'revoked');}
check(ns_effective_level(4,null,$now)===4&&ns_effective_level(6,null,$now)===6,'legacy_vip_preserved');check(ns_effective_level(5,['baseLevel'=>3,'status'=>'active','until'=>$now+10],$now)===5,'administrator_family_change_wins');
echo "SUBSCRIPTION_POLICY_CALENDAR_EXPIRY_LEGACY_ROLE_TESTS_OK\n";
