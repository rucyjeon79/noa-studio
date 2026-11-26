<?php
require_once dirname(__DIR__, 2) . '/common.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$boards=busan_news_split_active()?array_keys(busan_news_sections()):['busan_news'];
$items=[];
foreach($boards as $id){
    $b=sql_fetch("SELECT * FROM {$g5['board_table']} WHERE bo_table='$id'",false);
    $group=!empty($b['gr_id'])?get_group($b['gr_id']):[];
    if((int)($b['bo_list_level']??99)!==1||(int)($b['bo_read_level']??99)!==1||empty($group)||!empty($group['gr_use_access'])||!empty($b['bo_use_cert']))continue;
    $table=$g5['write_prefix'].$id;
    $result=sql_query("SELECT wr_id,wr_subject,wr_1,wr_2,wr_link1 FROM `$table`
        WHERE wr_is_comment=0 AND wr_3<>'' AND FIND_IN_SET('secret',wr_option)=0
        AND wr_1 BETWEEN DATE_SUB(DATE('".G5_TIME_YMD."'),INTERVAL 1 MONTH) AND '".G5_TIME_YMD."'",false);
    if($result)while($r=sql_fetch_array($result)){
        $items[]=['id'=>(int)$r['wr_id'],'title'=>$r['wr_subject'],'source'=>$r['wr_link1'],'board'=>$id,
            'url'=>G5_BBS_URL.'/board.php?bo_table='.$id.'&wr_id='.(int)$r['wr_id'],
            '_topic'=>(int)$r['wr_2'],'_date'=>$r['wr_1']];
    }
}
usort($items,static function($a,$b){return ($a['_topic']<=>$b['_topic'])?:strcmp($b['_date'],$a['_date'])?:($b['id']<=>$a['id']);});
foreach($items as &$item){unset($item['_topic'],$item['_date']);}unset($item);
echo json_encode($items,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
