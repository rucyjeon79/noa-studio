<?php
/** Private request bodies/comments never inherit native member-level or password-session bypasses. */
if(!defined('_GNUBOARD_'))exit;
$nc_board=(string)($bo_table??$_GET['bo_table']??$_POST['bo_table']??'');
$nc_path=(string)(parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH)??'');
$nc_native=str_starts_with($nc_path,'/bbs/')||(defined('G5_BBS_PATH')&&str_starts_with((string)($_SERVER['SCRIPT_FILENAME']??''),G5_BBS_PATH.'/'));
// Old board-reading addresses resolve to the single community view.
if($nc_path==='/bbs/board.php'&&($_SERVER['REQUEST_METHOD']??'GET')==='GET'&&($_GET['native']??'')!=='1'&&preg_match('/^[A-Za-z0-9_]{1,20}$/D',$nc_board)){
 $params=$nc_board==='song_request'?['category'=>'story','view'=>'list']:['board'=>$nc_board];$post=max(0,(int)($_GET['wr_id']??0));if($post)$params['nativePost']=$post;
 header('Location: /noa-lounge.php?'.http_build_query($params).($post?'#noa-'.$nc_board.'-'.$post:'#ec-content'),true,302);exit;
}
if($nc_board==='song_request'&&$nc_native&&($is_admin??'')!=='super'){
 http_response_code(403);header('Cache-Control: private, no-store');header('Content-Type: text/html; charset=utf-8');echo '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>사연곡 신청 | NOA STUDIO</title><link rel="stylesheet" href="/noa-ui.css"><body class="noa-page"><main><h1>사연곡 신청</h1><p>신청 내용은 커뮤니티의 사연곡 신청 게시판에서 글 비밀번호로 확인해 주세요.</p><a href="/noa-lounge.php?category=story&amp;view=list#noa-song-requests">사연곡 신청 게시판</a></main></body></html>';exit;
}
unset($nc_board,$nc_path,$nc_native);
