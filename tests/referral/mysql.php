<?php
require __DIR__.'/../subscription/mysql_test.php';require __DIR__.'/../../bridge/referral-core.php';
ns_q("ALTER TABLE g5_member ADD mb_datetime VARCHAR(19) NOT NULL DEFAULT '2026-01-01 00:00:00', ADD mb_leave_date VARCHAR(8) NOT NULL DEFAULT '', ADD mb_intercept_date VARCHAR(8) NOT NULL DEFAULT ''");
function seed_ref($id,$date='2026-10-31 12:00:00'){ns_q('INSERT INTO g5_member(mb_id,mb_level,mb_point,mb_datetime) VALUES('.ns_e($id).',2,0,'.ns_e($date).')');}
foreach(['inviter','newbie','newbie2','inviter2','failed','race_new','gone']as $id)seed_ref($id);
$link=nrf_link('inviter');check(nrf_link('inviter')===$link,'stable_member_link');$code=substr($link,strpos($link,'invite=')+7);check(strlen($code)===48,'opaque_code');$invite=nrf_invite($code,time());check($invite!==null,'valid_invitation');check(nrf_invite('forged',time())===null,'invalid_code');check(nrf_session_invite(['noa_referral'=>$invite],time()+8*86400)!==null,'no_unrequested_reward_deadline');
check(!nrf_native_completed('regular','','2026-10-31 12:00:00'),'existing_login_no_reward');check(!nrf_native_completed('newbie','newbie','2026-10-31 12:00:00'),'unchanged_signup_marker');check(nrf_native_completed('newbie','','2026-10-31 12:00:00'),'native_success');
nrf_complete('newbie',$invite,'2026-10-31 12:00:00');check(get_point_sum('newbie')===500&&get_point_sum('inviter')===500,'both_500');nrf_complete('newbie',$invite,'2026-10-31 12:00:00');nrf_pay('newbie');check(get_point_sum('inviter')===500,'repeat_once');
$second=nrf_invite(substr(nrf_link('inviter2'),strpos(nrf_link('inviter2'),'invite=')+7),time());nrf_complete('newbie',$second,'2026-10-31 12:00:00');check(get_point_sum('inviter2')===0,'cannot_change_inviter');
nrf_complete('inviter',$invite,'2026-10-31 12:00:00');check(!ns_doc(nrf_key('inviter'))&&get_point_sum('inviter')===500,'no_self_invitation');
nrf_complete('newbie2',$invite,'wrong-date');check(get_point_sum('newbie2')===0,'proof_required');
ns_q("CREATE TRIGGER nrf_failure BEFORE INSERT ON g5_point FOR EACH ROW BEGIN IF @nrf_fail=1 AND NEW.mb_id='failed' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='second_credit_failure'; END IF; END");ns_q('SET @nrf_fail=1');try{nrf_complete('failed',$invite,'2026-10-31 12:00:00');throw new RuntimeException('failure_missing');}catch(mysqli_sql_exception $e){}ns_q('SET @nrf_fail=0');check(get_point_sum('inviter')===500&&get_point_sum('failed')===0,'both_rollback');check(ns_doc(nrf_key('failed'))['data']['state']==='pending','retry_persisted');nrf_pay('failed');check(get_point_sum('failed')===500&&get_point_sum('inviter')===1000,'retry_both_once');
ns_q("UPDATE g5_member SET mb_leave_date='20261031' WHERE mb_id='gone'");nrf_complete('gone',$invite,'2026-10-31 12:00:00');check(get_point_sum('gone')===0,'withdrawn_excluded');
file_put_contents(sys_get_temp_dir().'/nrf-ci-code',$code);
echo "REFERRAL_BOTH_500_REPLAY_SELF_EXISTING_LOGIN_PROOF_ATOMIC_ROLLBACK_RETRY_OK\n";
