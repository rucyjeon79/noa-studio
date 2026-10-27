<?php
/** Bounded event-driven delivery; the scheduled worker remains the retry backstop. */
declare(strict_types=1);
if(!defined('_GNUBOARD_'))exit;
function nnt_b64(string $s):string{return rtrim(strtr(base64_encode($s),'+/','-_'),'=');}
function nnt_un64(string $s):string{$v=base64_decode(strtr($s,'-_','+/'),true);if($v===false)throw new RuntimeException('push_encoding');return $v;}
function nnt_inline_capable():bool{return function_exists('curl_init')&&function_exists('openssl_pkey_derive')&&function_exists('hash_hkdf');}
function nnt_push_request(array $job,array $cfg,int $now,?OpenSSLAsymmetricKey $ephemeral=null):array{
 $sub=nnt_subscription($job['subscription']);$peer=nnt_un64($sub['p256dh']);$auth=nnt_un64($sub['auth']);
 $key=$ephemeral??openssl_pkey_new(['private_key_type'=>OPENSSL_KEYTYPE_EC,'curve_name'=>'prime256v1']);if(!$key)throw new RuntimeException('push_key');
 $details=openssl_pkey_get_details($key);$pub="\x04".str_pad($details['ec']['x'],32,"\0",STR_PAD_LEFT).str_pad($details['ec']['y'],32,"\0",STR_PAD_LEFT);
 $pem="-----BEGIN PUBLIC KEY-----\n".chunk_split(base64_encode(hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200').$peer),64,"\n")."-----END PUBLIC KEY-----\n";
 $shared=openssl_pkey_derive($pem,$key,32);if($shared===false)throw new RuntimeException('push_peer');
 // RFC 8291 / RFC 8188: one final aes128gcm record, with an ephemeral P-256 key.
 $ikm=hash_hkdf('sha256',$shared,32,"WebPush: info\0".$peer.$pub,$auth);$salt=random_bytes(16);
 $cek=hash_hkdf('sha256',$ikm,16,"Content-Encoding: aes128gcm\0",$salt);$nonce=hash_hkdf('sha256',$ikm,12,"Content-Encoding: nonce\0",$salt);
 $plain=json_encode($job['payload'],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)."\x02";if(strlen($plain)>3900)throw new RuntimeException('push_size');
 $encrypted=openssl_encrypt($plain,'aes-128-gcm',$cek,OPENSSL_RAW_DATA,$nonce,$tag,'',16);if($encrypted===false)throw new RuntimeException('push_encrypt');
 $body=$salt.pack('N',4096).chr(65).$pub.$encrypted.$tag;
 $origin='https://'.strtolower(parse_url($sub['endpoint'],PHP_URL_HOST));
 $jwt=nnt_b64('{"typ":"JWT","alg":"ES256"}').'.'.nnt_b64(json_encode(['aud'=>$origin,'exp'=>$now+3600,'sub'=>'https://noastudio.ai.kr'],JSON_THROW_ON_ERROR));
 if(!openssl_sign($jwt,$der,$cfg['privateKey'],OPENSSL_ALGO_SHA256))throw new RuntimeException('push_sign');
 // P-256 ECDSA DER INTEGERs to JOSE's fixed-width r || s.
 if(strlen($der)<8||ord($der[0])!==48||ord($der[2])!==2)throw new RuntimeException('push_signature');
 $rlen=ord($der[3]);$offset=4+$rlen;if(!isset($der[$offset+1])||ord($der[$offset])!==2)throw new RuntimeException('push_signature');
 $r=ltrim(substr($der,4,$rlen),"\0");$s=ltrim(substr($der,$offset+2,ord($der[$offset+1])),"\0");if(strlen($r)>32||strlen($s)>32)throw new RuntimeException('push_signature');
 $jwt.='.'.nnt_b64(str_pad($r,32,"\0",STR_PAD_LEFT).str_pad($s,32,"\0",STR_PAD_LEFT));
 return ['url'=>$sub['endpoint'],'body'=>$body,'headers'=>['TTL: 86400','Urgency: high','Content-Type: application/octet-stream','Content-Encoding: aes128gcm','Authorization: vapid t='.$jwt.', k='.$cfg['publicKey']]];
}
function nnt_inline_send(array $job,array $cfg):int{
 $request=nnt_push_request($job,$cfg,time());$curl=curl_init($request['url']);
 curl_setopt_array($curl,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>$request['body'],CURLOPT_HTTPHEADER=>$request['headers'],CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_CONNECTTIMEOUT_MS=>1000,CURLOPT_TIMEOUT_MS=>2500,CURLOPT_WRITEFUNCTION=>static fn($c,$bytes)=>strlen($bytes)]);
 try{curl_exec($curl);return (int)curl_getinfo($curl,CURLINFO_RESPONSE_CODE);}finally{curl_close($curl);}
}
function nnt_inline_drain(PDO $db,array $cfg,?callable $send=null):array{
 $result=['claimed'=>0,'accepted'=>0,'retry'=>0];if(($cfg['inlineDispatch']??true)!==true||$db->inTransaction())return $result;
 // Cross-request lock bounds load; SQL leases also exclude the scheduled worker.
 if(!(int)nnt_one($db,"SELECT GET_LOCK('noa_notification_inline',0) acquired")['acquired'])return $result;
 try{
  nnt_collect($db,time());$jobs=nnt_claim($db,time(),2);$result['claimed']=count($jobs);
  foreach($jobs as $job){try{$code=$send?$send($job,$cfg):nnt_inline_send($job,$cfg);}catch(Throwable $e){$code=0;}
   nnt_ack($db,[['id'=>$job['id'],'device'=>$job['device'],'lease'=>$job['lease'],'http'=>$code]],time());$result[$code>=200&&$code<300?'accepted':'retry']++;
  }
  nnt_exec($db,"INSERT INTO noa_notification_cursor VALUES ('inline_last_run',?) ON DUPLICATE KEY UPDATE position=VALUES(position)",[time()]);
  return $result;
 }finally{nnt_one($db,"SELECT RELEASE_LOCK('noa_notification_inline') released");}
}
