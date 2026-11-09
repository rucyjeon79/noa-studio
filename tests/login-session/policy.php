<?php
define('_GNUBOARD_',true);require dirname(__DIR__,2).'/deploy/noa-app/engine/session-policy.php';
function check($v){if(!$v)throw new RuntimeException('session_policy_assertion');}
$p=['path'=>'/','domain'=>''];$secure=n80_session_cookie_options($p,true,false,true,1000,'none');
check($secure['secure']&&$secure['httponly']&&$secure['samesite']==='None'&&$secure['expires']===605800);
check(n80_session_cookie_options($p,false,false,true,1000,'none')['expires']===0);
check(n80_session_cookie_options($p,true,true,true,1000,'none')['expires']<1000);
check(n80_session_use_popup()===false);
echo "SESSION_HTTPS_HTTPONLY_PAYMENT_SAMESITE_SINGLE_WINDOW_POLICY_OK\n";

require dirname(__DIR__,2).'/deploy/noa-app/engine/registry.php';
check(in_array('noa-app/engine/session-policy.php',noa_engine_modules()['identity']['sources'],true));
