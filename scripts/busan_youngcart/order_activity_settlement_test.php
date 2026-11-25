<?php
declare(strict_types=1);
require __DIR__.'/../../deploy/busan/youngcart/pointzone-activity-settlement.php';
require __DIR__.'/../../deploy/busan/youngcart/pointzone-activities.php';
require __DIR__.'/../../deploy/busan/youngcart/existing-point-order-store.php';
require __DIR__.'/../../deploy/busan/youngcart/native-cart.php';
if(getenv('BUSAN_FIXTURE_DB')!=='pointzone_fixture')throw new RuntimeException('fixture only');
$db=new PDO('mysql:host=127.0.0.1;port=3306;dbname=pointzone_fixture;charset=utf8mb4','root','fixture-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
if($db->query('SELECT DATABASE()')->fetchColumn()!=='pointzone_fixture')throw new RuntimeException('fixture only');
$db->exec("SET SESSION sql_mode='NO_ENGINE_SUBSTITUTION'");
define('_GNUBOARD_',true);define('G5_TIME_YMD',date('Y-m-d'));define('G5_TIME_YMDHIS',date('Y-m-d H:i:s'));define('G5_SERVER_TIME',time());
$config=['cf_use_point'=>1,'cf_point_term'=>0];$g5=['member_table'=>'g5_member','point_table'=>'g5_point'];
function sql_query($sql,$show=true){return $GLOBALS['db']->query($sql);}
function sql_fetch($sql,$show=true){return sql_query($sql,$show)->fetch(PDO::FETCH_ASSOC);}
function sql_fetch_array($r){return $r->fetch(PDO::FETCH_ASSOC);}
function sql_real_escape_string($v){return substr($GLOBALS['db']->quote($v),1,-1);}
require __DIR__.'/order_existing_native_functions_fixture.php';
function ckFeature($v,$label){if(!$v)throw new RuntimeException($label);}
function rejectFeature(callable $f){try{$f();}catch(DomainException $e){return;}throw new RuntimeException('expected rejection');}
function actorFeature($id,$admin=false){$GLOBALS['member']=['mb_id'=>$id,'mb_leave_date'=>'','mb_intercept_date'=>''];$GLOBALS['is_member']=true;$GLOBALS['is_admin']=$admin?'super':'';}
$api=new BusanPointZoneActivities($db);$settle=new BusanActivitySettlement($db);$points=BusanExistingPoints::native();
$base=['title'=>'Settlement fixture','description'=>'Isolated only','opens_at'=>'2020-01-01 00:00:00','closes_at'=>'2099-01-01 00:00:00'];
actorFeature('admin',true);
$auction=$api->saveDraft($base+['kind'=>'auction','point_amount'=>100,'step_points'=>10]);$settle->publish($auction['id']);
$sharing=$api->saveDraft($base+['kind'=>'sharing','point_amount'=>50]);$settle->publish($sharing['id']);
$event=$api->saveDraft($base+['kind'=>'events','point_amount'=>25]);$settle->publish($event['id']);
$profile=$api->saveDraft($base+['kind'=>'profile','item_id'=>str_repeat('8',20),'duration_days'=>30]);
$db->prepare("UPDATE bpz_activity SET state='open' WHERE id=?")->execute([$profile['id']]);
actorFeature('api_alice');
$start=$points->balance('api_alice');$start2=$points->balance('api_pending');
$bid=$settle->bid($auction['id'],str_repeat('1',32),100);
ckFeature($settle->bid($auction['id'],str_repeat('1',32),100)['id']===$bid['id'],'bid retry');
rejectFeature(fn()=>$settle->bid($auction['id'],str_repeat('2',32),105));
rejectFeature(fn()=>$settle->closeAuction($auction['id']));
actorFeature('api_pending');$win=$settle->bid($auction['id'],str_repeat('3',32),110);
actorFeature('admin',true);
$db->prepare("UPDATE bpz_activity SET closes_at='2021-01-01 00:00:00' WHERE id=?")->execute([$auction['id']]);
$r=$settle->closeAuction($auction['id']);
ckFeature($r['state']==='awarded'&&$r['id']===$win['id']&&$points->balance('api_pending')===$start2-110&&$points->balance('api_alice')===$start,'winner only debit');
rejectFeature(fn()=>$settle->closeAuction($auction['id']));
actorFeature('api_alice');$c=$settle->contribute($sharing['id'],str_repeat('4',32));
ckFeature($c['state']==='confirmed'&&$points->balance('api_alice')===$start-50,'campaign debit');
ckFeature($settle->contribute($sharing['id'],str_repeat('4',32))['id']===$c['id']&&$points->balance('api_alice')===$start-50,'contribution retry');
$join=$api->joinEvent($event['id'],str_repeat('5',32));
actorFeature('admin',true);$a=$settle->awardEvent($event['id'],$join['id']);
ckFeature($a['state']==='awarded'&&$points->balance('api_alice')===$start-25,'event reward');
ckFeature($settle->awardEvent($event['id'],$join['id'])['id']===$a['id']&&$points->balance('api_alice')===$start-25,'reward retry');
actorFeature('api_alice');
$cart='123456789012395';$item=str_repeat('8',20);
(new BusanNativeCart($db))->set('api_alice',$cart,$item,1);
$orders=new BusanPointOrderSettlement($points,new BusanExistingPointOrderStore($db));
$orders->purchase('api_alice',$cart,str_repeat('6',32));
$e=$api->claimProfile($profile['id'],$cart);
ckFeature($api->claimProfile($profile['id'],$cart)['id']===$e['id'],'idempotent entitlement');
ckFeature($api->equip($e['id'])['equipped']===$e['id']&&$api->equipped()['id']===$e['id'],'equip owned');
actorFeature('api_pending');rejectFeature(fn()=>$api->equip($e['id']));rejectFeature(fn()=>$api->claimProfile($profile['id'],$cart));
actorFeature('api_alice');$api->equip(null);ckFeature($api->equipped()===null,'unequip');
$api->equip($e['id']);$orders->cancel('api_alice',$cart);ckFeature($api->equipped()===null,'cancel invalidates selection');
rejectFeature(fn()=>$api->equip($e['id']));
echo "BUSAN_POINTZONE_ACTIVITY_SETTLEMENT_AND_PROFILE_OK\n";
