<?php
declare(strict_types=1);
/** Exercises native accounting on a uniquely marked disposable account; no external payment or public post. */
function nrm_verify_live():array{
 global $g5;$id='nq_'.bin2hex(random_bytes(7));$marker='NOA_MEMBERSHIP_QA_'.bin2hex(random_bytes(12));$created=false;$cases=[];
 $check=static function(bool $v,string $name)use(&$cases){if(!$v)throw new RuntimeException('native_check_'.$name);$cases[]=$name;};
 try{
  if(ns_one('SELECT mb_id FROM '.ns_table('member_table').' WHERE mb_id='.ns_e($id)))throw new RuntimeException('qa_identity_collision');
  $fields=[];$columns=ns_q('SHOW COLUMNS FROM '.ns_table('member_table'));while($col=sql_fetch_array($columns)){
   if(preg_match('/^(?:date|datetime|timestamp)/i',$col['Type'])&&str_starts_with((string)$col['Default'],'0000-')){$fields[$col['Field']]=strtolower($col['Type'])==='date'?date('Y-m-d'):date('Y-m-d H:i:s');continue;}
   if(str_contains($col['Extra'],'auto_increment')||$col['Default']!==null||$col['Null']==='YES')continue;
   $fields[$col['Field']]=preg_match('/int|decimal|float|double|bit/i',$col['Type'])?0:(preg_match('/date|time/i',$col['Type'])?date('Y-m-d H:i:s'):'');
  }
  $fields=array_replace($fields,['mb_id'=>$id,'mb_password'=>get_encrypt_string(bin2hex(random_bytes(32))),'mb_name'=>'NOA QA','mb_nick'=>$id,'mb_email'=>$id.'@example.invalid','mb_level'=>2,'mb_profile'=>$marker,'mb_datetime'=>date('Y-m-d H:i:s'),'mb_email_certify'=>date('Y-m-d H:i:s'),'mb_today_login'=>date('Y-m-d H:i:s'),'mb_ip'=>'127.0.0.1','mb_login_ip'=>'127.0.0.1']);
  ns_q('INSERT INTO '.ns_table('member_table').' (`'.implode('`,`',array_keys($fields)).'`) VALUES ('.implode(',',array_map(static fn($v)=>ns_e((string)$v),array_values($fields))).')');$created=true;$now=time();
  nr_pending_login($id,$now);$check((int)get_point_sum($id)===0,'login_only_zero');
  $r=nr_reward($id,'comment','noa_qa',1,$now);$check($r['total']===130&&(int)get_point_sum($id)===130,'first_comment_130');
  nr_reward($id,'comment','noa_qa',1,$now);$check((int)get_point_sum($id)===130,'duplicate_reward_once');
  nr_reward($id,'write','noa_qa',2,$now);$check((int)get_point_sum($id)===180,'next_write_50');
  ns_atomic($id,true,fn()=>nr_insert_points($id,820,'QA verification','noa_qa','seed','credit'));$check((int)nr_refresh($id,$now)['mb_level']===3,'1000_promotion');
  ns_atomic($id,true,fn()=>nr_insert_points($id,5200,'QA verification','noa_qa','vip','credit'));
  $uuid=nr_renew_id($id,$now);$p=ns_policy();$o=nr_buy_vip($id,$uuid,$p['revision'],$now);$check($o['until']===$now+2592000&&(int)get_point_sum($id)===3200&&(int)nr_refresh($id,$now)['mb_level']===4,'vip_3000_exact_30_days');
  nr_buy_vip($id,$uuid,$p['revision'],$now);$check((int)get_point_sum($id)===3200,'duplicate_purchase_once');
  nr_set_auto($id,true,0,$now);$r=nr_renew($id,$o['until']);$check($r['state']==='renewed'&&(int)get_point_sum($id)===200,'opt_in_renewal_once');
  $grant=ns_doc(ns_member_key($id))['data'];$r=nr_renew($id,$grant['until']);$check($r['state']==='expired'&&(int)get_point_sum($id)===200&&(int)nr_refresh($id,$grant['until'])['mb_level']===2,'insufficient_renewal_no_debit_demotion');
 }finally{
  if($created){
   $m=ns_one('SELECT mb_profile FROM '.ns_table('member_table').' WHERE mb_id='.ns_e($id));if(!$m||!hash_equals($marker,$m['mb_profile']))throw new RuntimeException('qa_ownership_changed_preserved');
   ns_atomic($id,true,function()use($id,$marker){
    $rows=ns_q("SELECT doc_key FROM noa_documents WHERE (doc_key LIKE 'membership:%' OR doc_key LIKE 'subscription:%') AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.ownerId'))=".ns_e($id));$keys=[];while($row=sql_fetch_array($rows))$keys[]=$row['doc_key'];
    foreach($keys as $key){ns_q('DELETE FROM noa_document_history WHERE doc_key='.ns_e($key));ns_q('DELETE FROM noa_documents WHERE doc_key='.ns_e($key));}
    ns_q('DELETE FROM '.ns_table('point_table').' WHERE mb_id='.ns_e($id));ns_q('DELETE FROM '.ns_table('member_table').' WHERE mb_id='.ns_e($id).' AND mb_profile='.ns_e($marker));
   });
   if(ns_one('SELECT mb_id FROM '.ns_table('member_table').' WHERE mb_id='.ns_e($id)))throw new RuntimeException('qa_cleanup_incomplete');
  }
 }
 return ['passed'=>$cases,'temporaryAccountRemoved'=>true,'publicPostsCreated'=>0,'externalPayments'=>0,'realMemberPointsChanged'=>0];
}
