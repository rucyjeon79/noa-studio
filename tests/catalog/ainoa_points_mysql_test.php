<?php
/** Disposable CI database only. No network provider and no production balances. */
declare(strict_types=1);define('_GNUBOARD_',true);
define('G5_PATH',sys_get_temp_dir().'/noa-chat-ci/site');
mysqli_report(MYSQLI_REPORT_ERROR|MYSQLI_REPORT_STRICT);
$g5=['connect_db'=>new mysqli('127.0.0.1','root',getenv('NOA_MYSQL_PASSWORD'),'noa_inline_edit_test',3306),'member_table'=>'qa_chat_member','point_table'=>'qa_chat_point'];$g5['connect_db']->set_charset('utf8mb4');$config=['cf_use_point'=>true];
function sql_query($sql,$error=false){return $GLOBALS['g5']['connect_db']->query($sql);}
function sql_fetch_array($r){return $r->fetch_assoc();}
function get_point_sum($id){return (int)ns_one('SELECT COALESCE(SUM(po_point),0) n FROM qa_chat_point WHERE mb_id='.ns_e($id))['n'];}
function insert_point($id,$points,$content='',$table='',$rel='',$action=''){
 if(ns_one('SELECT po_id FROM qa_chat_point WHERE mb_id='.ns_e($id).' AND po_rel_table='.ns_e($table).' AND po_rel_id='.ns_e($rel).' AND po_rel_action='.ns_e($action)))return -1;
 ns_q('INSERT INTO qa_chat_point(mb_id,po_point,po_rel_table,po_rel_id,po_rel_action) VALUES('.ns_e($id).','.$points.','.ns_e($table).','.ns_e($rel).','.ns_e($action).')');ns_q('UPDATE qa_chat_member SET mb_point='.get_point_sum($id).' WHERE mb_id='.ns_e($id));return 1;
}
require __DIR__.'/../../bridge/ainoa-points.php';require __DIR__.'/../../bridge/lab-core.php';
function check($v,$message){if(!$v)throw new RuntimeException($message);}
function denied($f,$code){try{$f();throw new RuntimeException('missing_'.$code);}catch(DomainException $e){check($e->getMessage()===$code,$e->getMessage());}}
ns_q('CREATE TABLE qa_chat_member(mb_id VARCHAR(20) PRIMARY KEY,mb_level INT,mb_point INT) ENGINE=InnoDB');
ns_q('CREATE TABLE qa_chat_point(po_id BIGINT AUTO_INCREMENT PRIMARY KEY,mb_id VARCHAR(20),po_point INT,po_rel_table VARCHAR(32),po_rel_id VARCHAR(64),po_rel_action VARCHAR(32),KEY(mb_id)) ENGINE=InnoDB');
foreach(['paid'=>4,'creator'=>5,'staff'=>10,'expiry'=>4] as $owner=>$level){ns_q('INSERT INTO qa_chat_member VALUES('.ns_e($owner).','.$level.',0)');insert_point($owner,20,'seed','fixture',$owner,'seed');}
$root=dirname(G5_PATH).'/noa-ai-lab';mkdir($root,0700,true);file_put_contents($root.'/master.key',random_bytes(32));
$state=lab_defaults();$state['config']=array_merge($state['config'],['textEnabled'=>true,'maxJobUsd'=>1,'dailyBudgetUsd'=>10,'chatEnabled'=>true,'chatPoints'=>7]);$state['secrets']=lab_seal(['openaiKey'=>'isolated-unused-test-key']);file_put_contents($root.'/state.json',json_encode($state));
$id='11111111-1111-4111-8111-111111111111';$id2='22222222-2222-4222-8222-222222222222';$id3='33333333-3333-4333-8333-333333333333';$calls=0;
$generate=function()use(&$calls){$calls++;return '격리된 응답';};
$a=na_paid_reply('paid',$id,'one',7,$generate);check($a['balance']===13&&$a['chargedPoints']===7&&!$a['replayed'],'successful_debit');
$b=na_paid_reply('paid',$id,'one',7,$generate);check($b['replayed']&&$calls===1&&get_point_sum('paid')===13,'retry_exactly_once');
denied(fn()=>na_paid_reply('paid',$id,'different',7,$generate),'chat_request_conflict');
denied(fn()=>na_paid_reply('paid',$id2,'two',8,$generate),'chat_price_changed');check($calls===1,'price_change_no_provider');
denied(fn()=>na_paid_reply('creator',$id,'one',7,$generate),'paid_membership_required');denied(fn()=>na_paid_reply('staff',$id,'one',7,$generate),'regular_or_creator_required');
try{na_paid_reply('paid',$id2,'failed',7,fn()=>throw new RuntimeException('provider_failure'));throw new RuntimeException('missing_provider_failure');}catch(RuntimeException $e){check($e->getMessage()==='provider_failure',$e->getMessage());}check(get_point_sum('paid')===13,'provider_failure_no_debit');
ns_q("CREATE TRIGGER qa_chat_failure BEFORE INSERT ON noa_documents FOR EACH ROW BEGIN IF @qa_fail_chat=1 AND NEW.kind='ainoa_chat' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='fixture_failure'; END IF; END");ns_q('SET @qa_fail_chat=1');
try{na_paid_reply('paid',$id2,'failed-store',7,$generate);throw new RuntimeException('missing_storage_failure');}catch(mysqli_sql_exception $e){}ns_q('SET @qa_fail_chat=0');check(get_point_sum('paid')===13,'receipt_failure_rolls_back_debit');
na_paid_reply('paid',$id2,'two',7,$generate);$before=$calls;denied(fn()=>na_paid_reply('paid',$id3,'three',7,$generate),'insufficient_points');check(get_point_sum('paid')===6&&$calls===$before,'insufficient_no_provider_or_debit');
ns_atomic('expiry',false,fn()=>ns_put(ns_member_key('expiry'),'prefs',['ownerId'=>'expiry','status'=>'active','baseLevel'=>3,'until'=>time()-1],0,'fixture'));
denied(fn()=>na_paid_reply('expiry',$id,'one',7,$generate),'paid_membership_required');
ns_q('ALTER TABLE qa_chat_point ENGINE=MyISAM');denied(fn()=>na_paid_reply('paid',$id3,'three',7,$generate),'points_storage_not_ready');ns_q('ALTER TABLE qa_chat_point ENGINE=InnoDB');
check(na_chat_status(['mb_id'=>'paid','mb_level'=>4,'mb_point'=>6])['conversation']===false,'insufficient_hides_button');check(!na_chat_status(['mb_id'=>'creator','mb_level'=>5,'mb_point'=>20])['conversation'],'free_creator_hides_button');
echo "AINOA_POINT_TRANSACTION_RETRY_CONFLICT_PROVIDER_FAILURE_RECEIPT_ROLLBACK_EXPIRY_MYISAM_GATES_OK\n";
