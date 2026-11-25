<?php
declare(strict_types=1);
require __DIR__.'/../../deploy/busan/youngcart/pointzone-activities.php';
if(getenv('BUSAN_FIXTURE_DB')!=='pointzone_fixture')throw new RuntimeException('fixture only');
$db=new PDO('mysql:host=127.0.0.1;port=3306;dbname=pointzone_fixture;charset=utf8mb4','root','fixture-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
if($db->query('SELECT DATABASE()')->fetchColumn()!=='pointzone_fixture')throw new RuntimeException('fixture only');
$api=new BusanPointZoneActivities($db);
function ca($b):void{if(!$b)throw new RuntimeException('activity assertion');}
function denyActivity(callable $fn):void{try{$fn();}catch(DomainException $e){return;}throw new RuntimeException('expected rejection');}
function actorActivity($id,$admin=false):void{$GLOBALS['is_member']=true;$GLOBALS['is_admin']=$admin?'super':'';$GLOBALS['member']=['mb_id'=>$id,'mb_leave_date'=>'','mb_intercept_date'=>''];}
$base=['title'=>'Fixture only','description'=>'No live items','opens_at'=>'2020-01-01 00:00:00','closes_at'=>'2099-01-01 00:00:00'];
actorActivity('admin',true);
foreach(['auction','sharing','events','profile'] as $kind)ca($api->list($kind,true)===[]);
$auction=$api->saveDraft($base+['kind'=>'auction','point_amount'=>100,'step_points'=>10]);
$sharing=$api->saveDraft($base+['kind'=>'sharing','point_amount'=>50]);
$profile=$api->saveDraft($base+['kind'=>'profile','item_id'=>str_repeat('a',20),'duration_days'=>30]);
$reward=$api->saveDraft($base+['kind'=>'events','point_amount'=>10]);
foreach([$auction,$sharing,$profile,$reward] as $a)denyActivity(fn()=>$api->publish($a['id']));
$event=$api->saveDraft($base+['kind'=>'events','capacity'=>1]);
$event=$api->saveDraft(array_replace($base,['title'=>'Edited fixture'])+['kind'=>'events','capacity'=>1],$event['id']);
ca($event['title']==='Edited fixture');
ca($api->publish($event['id'])['state']==='open');
denyActivity(fn()=>$api->saveDraft($base+['kind'=>'events'],$event['id']));
actorActivity('alice');
ca(count($api->list('events'))===1);
ca($api->list('auction')===[]&&$api->list('sharing')===[]&&$api->list('profile')===[]);
denyActivity(fn()=>$api->list('auction',true));
denyActivity(fn()=>$api->saveDraft($base+['kind'=>'events']));
$entry=$api->joinEvent($event['id'],str_repeat('a',32));
ca($entry['state']==='confirmed');
ca($api->joinEvent($event['id'],str_repeat('a',32))['id']===$entry['id']);
ca($api->joinEvent($event['id'],str_repeat('b',32))['id']===$entry['id']);
ca(count($api->history())===1&&$api->entitlements()===[]);
actorActivity('bob');
ca($api->history()===[]&&$api->entitlements()===[]);
denyActivity(fn()=>$api->joinEvent($event['id'],str_repeat('c',32)));
denyActivity(fn()=>$api->participants($event['id']));
actorActivity('admin',true);
ca(count($api->participants($event['id']))===1);
ca($api->close($event['id'])['state']==='closed');
actorActivity('bob');denyActivity(fn()=>$api->joinEvent($event['id'],str_repeat('d',32)));
echo "BUSAN_POINTZONE_ACTIVITIES_FOUNDATION_OK\n";
