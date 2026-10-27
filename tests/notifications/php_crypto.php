<?php
define('_GNUBOARD_',true);
require __DIR__.'/../../bridge/notifications-core.php';require __DIR__.'/../../bridge/notifications-inline.php';
$input=json_decode(stream_get_contents(STDIN),true,16,JSON_THROW_ON_ERROR);
$out=nnt_push_request($input['job'],$input['config'],time(),isset($input['ephemeralKey'])?openssl_pkey_get_private($input['ephemeralKey']):null);$out['body']=base64_encode($out['body']);echo json_encode($out,JSON_THROW_ON_ERROR);
