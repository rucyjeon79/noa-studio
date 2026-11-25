<?php
declare(strict_types=1);
/*
 * CLI-only production preflight. Read-only metadata, no member rows, no secrets.
 * No conversion, lock, checkout, data changes, or authorization to enable sales.
 * Run only from the authorized Busan host.
 */
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
ini_set('display_errors','0');
mysqli_report(MYSQLI_REPORT_ERROR|MYSQLI_REPORT_STRICT);
function report(array $out,int $code):void{
    echo json_encode($out,JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR)."\n";exit($code);
}
try{
    $root='/hosting/rucyjeon79/html';
    $config=$root.'/data/dbconfig.php';
    if(!is_file($config))report(['status'=>'blocked','reason'=>'config_unavailable'],2);
    define('_GNUBOARD_',true);require $config;
    if(!defined('G5_MYSQL_DB')||G5_MYSQL_DB!=='rucyjeon79'||
       !defined('G5_MYSQL_USER')||G5_MYSQL_USER!=='rucyjeon79')
        report(['status'=>'blocked','reason'=>'wrong_database'],2);
    $db=new mysqli(G5_MYSQL_HOST,G5_MYSQL_USER,G5_MYSQL_PASSWORD,G5_MYSQL_DB);
    $db->set_charset('utf8mb4');
    $required=[
      'g5_member'=>['mb_id','mb_point'],
      'g5_point'=>['po_id','mb_id','po_point','po_use_point','po_expired','po_expire_date','po_mb_point','po_rel_table','po_rel_id','po_rel_action'],
      'yc5_cart'=>['ct_id','od_id','mb_id','ct_status','ct_stock_use'],
      'yc5_item'=>['it_id','it_stock_qty','it_price'],
      'yc5_order'=>['od_id','mb_id','od_status','od_receipt_point'],
      'yc5_category'=>['ca_id','ca_use'],
      'yc5_item_option'=>['it_id','io_id','io_use']
    ];
    $names="'".implode("','",array_keys($required))."'";
    $tables=[];$blockers=[];
    $rs=$db->query("SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ($names)");
    while($row=$rs->fetch_assoc())$tables[$row['TABLE_NAME']]=['engine'=>$row['ENGINE'],'columns'=>[],'indexes'=>[]];
    $rs=$db->query("SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ($names) ORDER BY ORDINAL_POSITION");
    while($row=$rs->fetch_assoc()){
        if(isset($tables[$row['TABLE_NAME']])&&in_array($row['COLUMN_NAME'],$required[$row['TABLE_NAME']],true))
            $tables[$row['TABLE_NAME']]['columns'][$row['COLUMN_NAME']]=['type'=>$row['COLUMN_TYPE'],'nullable'=>$row['IS_NULLABLE']];
    }
    $rs=$db->query("SELECT TABLE_NAME,INDEX_NAME,NON_UNIQUE,SEQ_IN_INDEX,COLUMN_NAME,SUB_PART FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ($names) ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX");
    while($row=$rs->fetch_assoc()){
        $tables[$row['TABLE_NAME']]['indexes'][$row['INDEX_NAME']][]=['column'=>$row['COLUMN_NAME'],'non_unique'=>(int)$row['NON_UNIQUE'],'prefix'=>$row['SUB_PART']];
    }
    foreach($required as $table=>$cols){
        if(!isset($tables[$table])){$blockers[]='missing_table:'.$table;continue;}
        if(strtoupper((string)$tables[$table]['engine'])!=='INNODB')$blockers[]='nontransactional:'.$table;
        foreach($cols as $col)if(!isset($tables[$table]['columns'][$col]))$blockers[]='missing_column:'.$table.'.'.$col;
    }
    $db->close();
    // A metadata pass does not prove shared-lock safety. Never emit ready=true.
    report(['status'=>'metadata_collected','tables'=>$tables,'blockers'=>$blockers,
        'shared_writer_audit'=>'required','expiry_allocation_audit'=>'required',
        'balance_reconciliation'=>'required','checkout_ready'=>false],$blockers?3:0);
}catch(Throwable $e){report(['status'=>'blocked','reason'=>'preflight_failed','checkout_ready'=>false],2);}
