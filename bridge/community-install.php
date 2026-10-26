<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
require_once __DIR__.'/community-core.php';
/** Create only the new private board. Existing boards, posts and member rows are never rewritten. */
function nc_install():array{
 global $g5;$lock=nc_one("SELECT GET_LOCK('noa-song-request-install',10) AS acquired");if((int)($lock['acquired']??0)!==1)throw new RuntimeException('install_busy');
 try{
  $boards=nc_table($g5['board_table']);$id=nc_q(NC_REQUEST_BOARD);$existing=nc_one("SELECT * FROM $boards WHERE bo_table=$id");
  if($existing&&!nc_private_policy($existing))throw new RuntimeException('existing_board_preserved');
  $tableName=$g5['write_prefix'].NC_REQUEST_BOARD;$table=nc_table($tableName);$meta=nc_one('SELECT TABLE_COMMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='.nc_q($tableName));
  if($meta&&$meta['TABLE_COMMENT']!==NC_REQUEST_MARKER)throw new RuntimeException('existing_table_preserved');
  if(!$meta){nc_query('CREATE TABLE '.$table.' LIKE '.nc_write_table('free'));nc_query('ALTER TABLE '.$table.' ENGINE=InnoDB, COMMENT='.nc_q(NC_REQUEST_MARKER));}
  $limits=nc_one("SELECT TABLE_COMMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='noa_request_limits'");
  if($limits&&$limits['TABLE_COMMENT']!==NC_REQUEST_MARKER)throw new RuntimeException('existing_rate_table_preserved');
  if(!$limits)nc_query("CREATE TABLE noa_request_limits (limit_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,hits INT UNSIGNED NOT NULL,reset_at BIGINT UNSIGNED NOT NULL,KEY expires(reset_at)) ENGINE=InnoDB COMMENT=".nc_q(NC_REQUEST_MARKER));
  if(!$existing){
   $row=nc_one("SELECT * FROM $boards WHERE bo_table='free'");if(!$row)throw new RuntimeException('native_board_template_missing');
   $overrides=['bo_table'=>NC_REQUEST_BOARD,'bo_subject'=>'사연곡 신청','bo_mobile_subject'=>'사연곡 신청','bo_admin'=>'','bo_list_level'=>2,'bo_read_level'=>10,'bo_write_level'=>10,'bo_reply_level'=>10,'bo_comment_level'=>10,'bo_html_level'=>10,'bo_link_level'=>10,'bo_upload_level'=>10,'bo_download_level'=>10,'bo_use_secret'=>2,'bo_use_search'=>0,'bo_use_rss_view'=>0,'bo_use_list_content'=>0,'bo_use_list_file'=>0,'bo_use_email'=>0,'bo_use_sns'=>0,'bo_use_cert'=>'','bo_count_write'=>0,'bo_count_comment'=>0,'bo_notice'=>'','bo_upload_count'=>0,'bo_read_point'=>0,'bo_write_point'=>0,'bo_comment_point'=>0,'bo_download_point'=>0,'bo_skin'=>'basic','bo_mobile_skin'=>'basic','bo_include_head'=>'','bo_include_tail'=>'','bo_content_head'=>'','bo_content_tail'=>'','bo_mobile_content_head'=>'','bo_mobile_content_tail'=>'','bo_10'=>NC_REQUEST_MARKER];
   foreach($overrides as $k=>$v)if(array_key_exists($k,$row))$row[$k]=$v;
   $sets=[];foreach($row as $key=>$value)$sets[]=nc_table($key).'='.nc_q((string)$value);nc_query('INSERT INTO '.$boards.' SET '.implode(',',$sets));
  }
  $after=nc_one("SELECT * FROM $boards WHERE bo_table=$id");if(!nc_private_policy($after))throw new RuntimeException('private_policy_readback_failed');
  return ['board'=>NC_REQUEST_BOARD,'created'=>!$existing,'readLevel'=>(int)$after['bo_read_level'],'commentLevel'=>(int)$after['bo_comment_level'],'secretRequired'=>(int)$after['bo_use_secret']===2,'searchEnabled'=>(bool)$after['bo_use_search'],'rssEnabled'=>(bool)$after['bo_use_rss_view'],'postCount'=>(int)nc_one("SELECT COUNT(*) AS n FROM $table WHERE wr_is_comment=0")['n'],'existingBoardsModified'=>0,'existingPostsModified'=>0,'memberRowsChanged'=>0,'pointsChanged'=>0];
 }finally{sql_query("SELECT RELEASE_LOCK('noa-song-request-install')",false);}
}
