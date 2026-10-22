<?php
declare(strict_types=1);
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
$credentialPath=dirname(__DIR__,2).'/busan-assistant-private/activity-account.json';
function activity_deny(): never {http_response_code(403);exit;}
if(!is_file($credentialPath)||is_link($credentialPath)||(fileperms($credentialPath)&0777)!==0600)activity_deny();
$identity=json_decode(file_get_contents($credentialPath),true);
$token=$_SERVER['HTTP_X_BUSAN_AGENT_TOKEN']??'';
if(!is_array($identity)||($identity['id']??'')!=='busanjibuon'||!is_string($identity['agent_token']??null)||!is_string($token)||!hash_equals($identity['agent_token'],$token))activity_deny();
if(($_SERVER['REQUEST_METHOD']??'')!=='GET'){http_response_code(405);exit;}
require dirname(__DIR__).'/common.php';
header('Content-Type: application/json; charset=utf-8');
$actor=get_member('busanjibuon');
if(empty($actor['mb_id'])||(int)($actor['mb_level']??0)!==10||!empty($actor['mb_leave_date'])||!empty($actor['mb_intercept_date'])||($actor['mb_memo']??'')!=='BUSAN_ON_ASSISTANT_ACTIVITY_ACCOUNT_V1'||!check_password($identity['password'],$actor['mb_password']))activity_deny();
$counts=sql_fetch("SELECT COUNT(*) total FROM {$g5['member_table']}",false);
$boards=sql_fetch("SELECT COUNT(*) total FROM {$g5['board_table']}",false);
if(!is_array($counts)||!isset($counts['total'])||!is_array($boards)||!isset($boards['total'])){http_response_code(503);exit;}
echo json_encode(['name'=>'부산지부ON','activity_member'=>['id'=>$actor['mb_id'],'name'=>$actor['mb_name'],'nickname'=>$actor['mb_nick'],'level'=>(int)$actor['mb_level']],'profile_url'=>G5_DATA_URL.'/member_image/'.substr($actor['mb_id'],0,2).'/'.get_mb_icon_name($actor['mb_id']).'.gif','scopes'=>['status:read'],'member_count'=>(int)$counts['total'],'board_count'=>(int)$boards['total']],JSON_UNESCAPED_UNICODE);
