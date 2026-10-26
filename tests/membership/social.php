<?php
declare(strict_types=1);require __DIR__.'/../../bridge/social-policy.php';
function sp_assert(bool $ok,string $why):void{if(!$ok)throw new RuntimeException($why);}
foreach(['Google','google','Kakao','kakao']as $p)sp_assert(nsp_provider($p)!==null,'allowed');
foreach(['naver','facebook','google/../','',[],null]as $p)sp_assert(nsp_provider($p)===null,'reject_provider');
foreach(['/bbs/register.php','/bbs/register_form.php','/bbs/register_form_update.php']as $p){sp_assert(nsp_decide($p,'GET',[],false,false)==='signup','direct_get');sp_assert(nsp_decide($p,'POST',[],false,false)==='deny','direct_post');sp_assert(nsp_decide($p,'POST',['provider'=>'Google'],false,true)==='deny','spoof_provider_not_native_registration');}
sp_assert(nsp_decide('/bbs/register_form_update.php','POST',['w'=>'u'],false,false)==='deny','guest_update_bypass');
sp_assert(nsp_decide('/bbs/register_form_update.php','POST',['w'=>'u'],true,false)==='allow','existing_profile_preserved');
foreach(['register_member.php','register_member_update.php']as $file){sp_assert(nsp_decide('/plugin/social/'.$file,'POST',['provider'=>'Google'],false,false)==='deny','social_session_required');sp_assert(nsp_decide('/plugin/social/'.$file,'POST',['provider'=>'Google'],false,true)==='allow','verified_social_flow');}
sp_assert(nsp_decide('/bbs/login.php','GET',[],false,false)==='login','social_entry');sp_assert(nsp_decide('/bbs/login.php','GET',['legacy'=>'1'],false,false)==='allow','admin_login_preserved');
foreach(['https://evil.example','//evil.example','/%2fevil.example','/\\evil.example',"/\r\nLocation:bad",['bad']]as $v)sp_assert(nsp_return($v)==='/','unsafe_redirect');sp_assert(nsp_return('/noa-my.php?tab=points')==='/noa-my.php?tab=points','local_redirect');
sp_assert(!nsp_status([])['google']['ready']&&!nsp_status([])['kakao']['ready'],'missing_credentials_disabled');
function social_session_exists_check(){return $GLOBALS['verified_profile']??false;}
sp_assert(!nsp_verified('Google'),'no_profile');$GLOBALS['verified_profile']=(object)['identifier'=>'123'];sp_assert(nsp_verified('Google')&&!nsp_verified('Naver'),'provider_and_server_session');
echo "SOCIAL_ONLY_REGISTRATION_GUARDS_EXISTING_LOGIN_AND_PROFILE_OK\n";
