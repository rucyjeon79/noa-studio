<?php
require_once dirname(__DIR__, 2) . '/common.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$b = sql_fetch("SELECT * FROM {$g5['board_table']} WHERE bo_table='busan_news'", false);
$group = !empty($b['gr_id']) ? get_group($b['gr_id']) : [];
$items = [];
if ((int)($b['bo_list_level'] ?? 99) === 1 && (int)($b['bo_read_level'] ?? 99) === 1
    && !empty($group) && empty($group['gr_use_access']) && empty($b['bo_use_cert'])) {
    $table = $g5['write_prefix'].'busan_news';
    $result = sql_query("SELECT wr_id,wr_subject,wr_1,wr_2,wr_link1 FROM `$table`
        WHERE wr_is_comment=0 AND wr_3<>'' AND FIND_IN_SET('secret',wr_option)=0
        AND wr_1 BETWEEN DATE_SUB(DATE('".G5_TIME_YMD."'),INTERVAL 1 MONTH) AND '".G5_TIME_YMD."'
        ORDER BY CAST(wr_2 AS UNSIGNED),wr_1 DESC,wr_id DESC", false);
    if ($result) while ($r = sql_fetch_array($result)) {
        $items[] = ['id'=>(int)$r['wr_id'], 'title'=>$r['wr_subject'], 'source'=>$r['wr_link1'],
            'url'=>G5_BBS_URL.'/board.php?bo_table=busan_news&wr_id='.(int)$r['wr_id']];
    }
}
echo json_encode($items, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
