<?php
declare(strict_types=1);
require __DIR__.'/../../bridge/notices.php';
function nn_check($ok,$label){if(!$ok)throw new RuntimeException($label);}
$rows=[];for($i=6;$i>=1;$i--)$rows[]=['wr_id'=>$i,'wr_subject'=>'공지 '.$i,'wr_content'=>"<p>안내</p><script>alert(1)</script><img src=x onerror=alert(2)><p>다음 줄</p>",'wr_datetime'=>'2026-10-26 10:00:00','wr_is_comment'=>0,'wr_option'=>'html1'];
$rows=array_merge([['wr_id'=>9,'wr_option'=>'html1,secret'],['wr_id'=>8,'wr_is_comment'=>1]],$rows);
$items=nn_project($rows);nn_check(count($items)===5,'one_featured_four_previous');nn_check(array_column($items,'id')===[6,5,4,3,2],'order_and_secret_filtered');nn_check($items[0]['body']==="안내\n다음 줄",'safe_multiline_content');
$g5=['board_table'=>'g5_board','group_table'=>'g5_group','write_prefix'=>'g5_write_'];$member=['mb_level'=>1];$is_admin='';$testBoard=['bo_list_level'=>1,'bo_read_level'=>2,'bo_use_cert'=>'','gr_use_access'=>0];$queried=0;
function sql_fetch($q,$error=false){return $GLOBALS['testBoard'];}function sql_query($q,$error=false){$GLOBALS['queried']++;return false;}
nn_check(nn_native_notices()['restricted']&&$queried===0,'no_unreadable_content_query');$testBoard['bo_read_level']=1;$testBoard['gr_use_access']=1;nn_check(nn_native_notices()['restricted']&&$queried===0,'group_fails_closed');$testBoard['gr_use_access']=0;$testBoard['bo_use_cert']='cert';nn_check(nn_native_notices()['restricted']&&$queried===0,'certification_fails_closed');
echo "NOTICE_SAFE_NATIVE_PROJECTION_FIVE_ROWS_PERMISSIONS_OK\n";
