<?php
declare(strict_types=1);
ini_set('display_errors','0');
error_reporting(0);
if (!hash_equals('__BOOTSTRAP_HASH__',hash('sha256',$_SERVER['HTTP_X_BUSAN_PROVISION']??''))) {http_response_code(404);exit;}
if (($_SERVER['REQUEST_METHOD']??'')!=='POST') {http_response_code(405);exit;}
require '/hosting/rucyjeon79/html/common.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
function account_stop(string $reason): never { http_response_code(409);echo json_encode(['status'=>'blocked','reason'=>$reason]);exit; }
if (G5_PATH!=='/hosting/rucyjeon79/html'||G5_MYSQL_USER!=='rucyjeon79'||G5_MYSQL_DB!=='rucyjeon79') account_stop('target_mismatch');
require_once G5_LIB_PATH.'/register.lib.php';
$id='busanjibuon';$name='부산지부ON';$marker='BUSAN_ON_ASSISTANT_ACTIVITY_ACCOUNT_V1';$email='busanjibuon@assistant.invalid';
if (valid_mb_nick($name)) account_stop('native_nickname_rejected');
$private='/hosting/rucyjeon79/busan-assistant-private';
if(realpath($private)!==$private || (fileperms($private)&0777)!==0700) account_stop('private_path_unverified');
$credentialPath=$private.'/activity-account.json';
$existing=get_member($id);
if (!empty($existing['mb_id']) && ($existing['mb_memo']??'')!==$marker) account_stop('existing_account_not_owned');
if (empty($existing['mb_id'])) {
    $escaped=sql_real_escape_string($name);$mail=sql_real_escape_string($email);
    $duplicate=sql_fetch("SELECT COUNT(*) n FROM {$g5['member_table']} WHERE mb_nick='$escaped' OR mb_email='$mail'",false);
    if(!is_array($duplicate)||!array_key_exists('n',$duplicate)||(int)$duplicate['n']!==0) account_stop('nickname_or_email_conflict');
}
if(is_file($credentialPath)) {
    if(is_link($credentialPath)||(fileperms($credentialPath)&0777)!==0600) account_stop('credential_mode_mismatch');
    $credential=json_decode(file_get_contents($credentialPath),true);
    if(($credential['id']??'')!==$id||!is_string($credential['password']??null)||!is_string($credential['agent_token']??null)) account_stop('credential_invalid');
} else {
    if(!empty($existing['mb_id'])) account_stop('owned_account_credential_missing');
    $credential=['id'=>$id,'password'=>bin2hex(random_bytes(32)),'agent_token'=>bin2hex(random_bytes(32)),'scope'=>'status-only'];
    $oldMask=umask(0077);$f=fopen($credentialPath,'x');
    if(!$f) account_stop('credential_create_failed');
    fwrite($f,json_encode($credential));fclose($f);chmod($credentialPath,0600);umask($oldMask);
}
$ownerBefore=$config['cf_admin'];
$created=false;
if(empty($existing['mb_id'])) {
    $fields=['mb_id'=>$id,'mb_password'=>get_encrypt_string($credential['password']),'mb_name'=>$name,'mb_nick'=>$name,'mb_nick_date'=>G5_TIME_YMD,'mb_email'=>$email,'mb_homepage'=>'','mb_tel'=>'','mb_hp'=>'','mb_certify'=>'','mb_adult'=>0,'mb_zip1'=>'','mb_zip2'=>'','mb_addr1'=>'','mb_addr2'=>'','mb_addr3'=>'','mb_addr_jibeon'=>'','mb_signature'=>'','mb_leave_date'=>'','mb_intercept_date'=>'','mb_memo'=>$marker,'mb_mailling'=>0,'mb_sms'=>0,'mb_open'=>1,'mb_profile'=>'부산지부 홈페이지를 관리하는 챗비서 부산지부ON입니다.','mb_level'=>10,'mb_datetime'=>G5_TIME_YMDHIS,'mb_ip'=>$_SERVER['REMOTE_ADDR'],'mb_email_certify'=>G5_TIME_YMDHIS];
    for($i=1;$i<=10;$i++)$fields['mb_'.$i]='';
    $sets=[];foreach($fields as $k=>$v)$sets[]="$k='".sql_real_escape_string((string)$v)."'";
    if(!sql_query("INSERT INTO {$g5['member_table']} SET ".implode(',',$sets),false)) account_stop('native_member_insert_failed');
    $created=true;
}
$memberCheck=get_member($id);
if(($memberCheck['mb_name']??'')!==$name||($memberCheck['mb_nick']??'')!==$name||(int)($memberCheck['mb_level']??0)!==10||!check_password($credential['password'],$memberCheck['mb_password'])) account_stop('account_verification_failed');
$symbol=G5_PATH.'/Custom/img/icon-512.png';
if(!is_file($symbol)||hash_file('sha256',$symbol)!=='40508c6ceac9f07794ea728c76998509faa4ef92171422aa4339ebc73faadada') account_stop('main_symbol_changed');
if(!function_exists('imagecreatefrompng')) account_stop('native_image_runtime_missing');
$src=imagecreatefrompng($symbol);if(!$src)account_stop('main_symbol_unreadable');
$avatar=get_mb_icon_name($id).'.gif';$files=[];
foreach(['member_image'=>['cf_member_img_width','cf_member_img_height',80],'member'=>['cf_member_icon_width','cf_member_icon_height',22]] as $folder=>$dims) {
    $dir=G5_DATA_PATH.'/'.$folder;if(!is_dir($dir)&&!mkdir($dir,0755))account_stop('image_directory_create_failed');
    if(realpath($dir)!==$dir)account_stop('unexpected_image_directory');
    $dir.='/'.substr($id,0,2);if(!is_dir($dir)&&!mkdir($dir,0755))account_stop('avatar_directory_create_failed');
    if(realpath($dir)!==$dir)account_stop('unexpected_avatar_directory');
    $path=$dir.'/'.$avatar;
    if(is_file($path)) {
        if(is_link($path))account_stop('unexpected_avatar_file');
        $state=$private.'/activity-avatar-'.$folder.'.sha256';
        if(!is_file($state)||trim(file_get_contents($state))!==hash_file('sha256',$path))account_stop('existing_avatar_not_owned');
    } else {
        $w=max(16,min(512,(int)($config[$dims[0]]??$dims[2])));$h=max(16,min(512,(int)($config[$dims[1]]??$dims[2])));
        $img=imagecreatetruecolor($w,$h);imagealphablending($img,false);imagesavealpha($img,true);
        $clear=imagecolorallocatealpha($img,0,0,0,127);imagefill($img,0,0,$clear);
        imagecopyresampled($img,$src,0,0,0,0,$w,$h,imagesx($src),imagesy($src));
        $temp=$private.'/avatar-'.bin2hex(random_bytes(12)).'.png';
        if(!imagepng($img,$temp))account_stop('avatar_encode_failed');imagedestroy($img);chmod($temp,0644);
        if(file_exists($path)||!rename($temp,$path))account_stop('avatar_commit_failed');
        $state=$private.'/activity-avatar-'.$folder.'.sha256';file_put_contents($state,hash_file('sha256',$path),LOCK_EX);chmod($state,0600);
    }
    $files[$folder]=str_replace(G5_DATA_PATH,G5_DATA_URL,$path);
}
imagedestroy($src);
$ownerAfter=sql_fetch("SELECT cf_admin FROM {$g5['config_table']} LIMIT 1",false);
if(($ownerAfter['cf_admin']??null)!==$ownerBefore)account_stop('owner_changed');
$profileHtml=get_member_profile_img($id);
if(strpos($profileHtml,$files['member_image'])===false)account_stop('native_profile_lookup_failed');
echo json_encode(['status'=>'verified','created'=>$created,'member_id'=>$id,'name'=>$memberCheck['mb_name'],'nickname'=>$memberCheck['mb_nick'],'level'=>(int)$memberCheck['mb_level'],'main_symbol_applied'=>true,'profile_url'=>$files['member_image'],'icon_url'=>$files['member'],'native_password_verified'=>true,'owner_unchanged'=>true,'credential_webroot_outside'=>true],JSON_UNESCAPED_UNICODE);
