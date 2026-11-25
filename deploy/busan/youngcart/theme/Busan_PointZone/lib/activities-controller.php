<?php
if(!defined('_GNUBOARD_'))exit;
require_once __DIR__.'/activities-bridge.php';
/* Included before shared header: POST must finish before rendering. */
$bpz_activityKinds=['auction'=>'경매','sharing'=>'나눔','events'=>'이벤트','profile'=>'꾸미기 아이템'];
$bpz_activityRows=[];$bpz_activityHistory=[];$bpz_entitlementRows=[];$bpz_activityError=false;$bpz_activityToken='';$bpz_activityMessage='';
if(isset($bpz_activityKinds[$bpz_section])||in_array($bpz_section,['my','manage','honor'],true)){
    try{
        $bpz_activityApi=BusanActivitiesBridge::open();
        $bpz_activityToken=BusanActivitiesBridge::csrf();
        if(($_SERVER['REQUEST_METHOD']??'GET')==='POST'){
            BusanActivitiesBridge::verify($_POST,$bpz_activityToken);
            $bpz_activityAction=$_POST['activity_action']??'';
            if($bpz_section==='events'&&$bpz_activityAction==='join'){
                $bpz_activityApi->joinEvent((string)($_POST['activity_id']??''),(string)($_POST['request_id']??''));
                header('Location: '.G5_URL.'/theme/Busan_PointZone/pointzone.php?section=events',true,303);exit;
            }
            throw new DomainException('허용되지 않은 요청');
        }
        if(isset($bpz_activityKinds[$bpz_section]))$bpz_activityRows=$bpz_activityApi->list($bpz_section);
        if($bpz_section==='my'||$bpz_section==='profile')$bpz_entitlementRows=$bpz_activityApi->entitlements();
        if($bpz_section==='my')$bpz_activityHistory=$bpz_activityApi->history();
    }catch(DomainException $e){$bpz_activityError=true;$bpz_activityMessage='요청 조건을 확인해 주세요.';}
    catch(Throwable $e){$bpz_activityError=true;}
}
