<?php
declare(strict_types=1);
require __DIR__.'/../subscription/native_fixture.php';
require __DIR__.'/../../bridge/fan-membership.php';
function expect(bool $ok):void{if(!$ok)throw new RuntimeException('fan assertion failed at '.debug_backtrace()[0]['line']);}
function denied(callable $fn):void{try{$fn();}catch(DomainException){return;}throw new RuntimeException('unexpected access');}
ns_q("ALTER TABLE g5_member ADD mb_leave_date VARCHAR(8) NOT NULL DEFAULT '', ADD mb_intercept_date VARCHAR(8) NOT NULL DEFAULT ''");
$config['cf_admin']='boss';
foreach(['boss'=>10,'lead'=>3,'fan'=>2,'reader'=>4,'staff'=>9,'artist'=>7] as $id=>$level)ns_q('INSERT INTO g5_member(mb_id,mb_level,mb_point) VALUES('.ns_e($id).','.$level.',0)');
denied(fn()=>nfan_appoint('boss','fan',5));denied(fn()=>nfan_appoint('staff','lead',6));
nfan_appoint('boss','lead',6);nfan_appoint('lead','fan',5);
$now=time();expect(nfan_monthly('lead',$now)===3000&&nfan_monthly('lead',$now)===0);
expect(nfan_monthly('fan',$now)===1000);
$id='a0000000-1111-4111-8111-111111111111';$second='b0000000-1111-4111-8111-111111111111';
$receipt=nfan_gift('lead','reader',125,$id);expect($receipt['rebate']===12&&nfan_gift('lead','reader',125,$id)===$receipt);
expect(get_point_sum('lead')===2887&&get_point_sum('reader')===125);
expect(nfan_gift('fan','reader',1000,$second)['rebate']===0&&get_point_sum('fan')===0);
denied(fn()=>nfan_gift('fan','reader',1,$id));denied(fn()=>nfan_gift('lead','artist',1,$second));
insert_point('lead',2000000,'seed','test','large','credit');
expect(nfan_gift('lead','reader',1000001,$second)['rebate']===100000);
foreach(['aide2','aide3','lead2'] as $id)ns_q('INSERT INTO g5_member(mb_id,mb_level,mb_point) VALUES('.ns_e($id).',3,0)');
nfan_appoint('lead','aide2',5);
expect(nfan_aide_count('lead')===2);
try{nfan_appoint('lead','aide3',5);throw new RuntimeException('third appointment accepted');}
catch(DomainException $e){expect($e->getMessage()==='aide_limit_reached');}
expect((int)nr_member('aide3')['mb_level']===3);
nfan_appoint('boss','lead2',6);
nfan_appoint('lead2','aide3',5);
expect(nfan_aide_count('lead2')===1);
nfan_appoint('boss','aide2',6);
expect(nfan_aide_count('lead')===1);
nfan_appoint('lead','reader',5);
expect(nfan_aide_count('lead')===2);
echo "FAN_APPOINTMENTS_MONTHLY_GIFTS_REPLAY_AND_REBATE_OK\n";
