<?php
if(!defined('_GNUBOARD_'))exit;
require_once __DIR__.'/activities-bridge.php';
/* Included before shared header: POST must finish before rendering. */
$bpz_activityKinds=['auction'=>'경매','sharing'=>'나눔','events'=>'이벤트','profile'=>'꾸미기 아이템'];
$bpz_financialEnabled=false;$bpz_rankRows=[];$bpz_equipped=null;$bpz_activityRows=[];$bpz_activityHistory=[];$bpz_entitlementRows=[];$bpz_activityError=false;$bpz_activityToken='';$bpz_activityMessage='';
if(isset($bpz_activityKinds[$bpz_section])||in_array($bpz_section,['my','manage','honor'],true)){
    try{
        $bpz_activityApi=BusanActivitiesBridge::open();
        $bpz_activityToken=BusanActivitiesBridge::csrf();
        $bpz_financialEnabled=BusanActivitiesBridge::financialEnabled();
        if(($_SERVER['REQUEST_METHOD']??'GET')==='POST'){
            BusanActivitiesBridge::verify($_POST,$bpz_activityToken);
            $bpz_activityAction=$_POST['activity_action']??'';
            if(($bpz_section==='auction'&&$bpz_activityAction==='bid')||($bpz_section==='sharing'&&$bpz_activityAction==='contribute')||($bpz_section==='profile'&&$bpz_activityAction==='claim')){
                if(!$bpz_financialEnabled){http_response_code(503);throw new DomainException('정산 잠금');}
                $bpz_activityId=BusanActivitiesBridge::stringField($_POST,'activity_id');
                if($bpz_activityAction==='claim')$bpz_activityApi->claimProfile($bpz_activityId,BusanActivitiesBridge::stringField($_POST,'order_id'));
                else{
                    $bpz_requestId=BusanActivitiesBridge::stringField($_POST,'request_id');
                    $bpz_settlement=BusanActivitiesBridge::settlement();
                    if($bpz_activityAction==='bid')$bpz_settlement->bid($bpz_activityId,$bpz_requestId,BusanActivitiesBridge::amount($_POST,'amount'));
                    else $bpz_settlement->contribute($bpz_activityId,$bpz_requestId);
                }
                header('Location: '.G5_URL.'/theme/Busan_PointZone/pointzone.php?section='.$bpz_section,true,303);exit;
            }
            if($bpz_section==='events'&&$bpz_activityAction==='join'){
                $bpz_activityApi->joinEvent(BusanActivitiesBridge::stringField($_POST,'activity_id'),BusanActivitiesBridge::stringField($_POST,'request_id'));
                header('Location: '.G5_URL.'/theme/Busan_PointZone/pointzone.php?section=events',true,303);exit;
            }
            if(in_array($bpz_section,['profile','my'],true)&&in_array($bpz_activityAction,['equip','unequip'],true)){
                $bpz_selection=$bpz_activityAction==='unequip'?null:($_POST['entitlement_id']??null);
                if($bpz_activityAction==='equip'&&!is_string($bpz_selection))throw new DomainException('invalid selection');
                $bpz_activityApi->equip($bpz_selection);
                header('Location: '.G5_URL.'/theme/Busan_PointZone/pointzone.php?section='.$bpz_section,true,303);exit;
            }
            throw new DomainException('허용되지 않은 요청');
        }
        if(isset($bpz_activityKinds[$bpz_section]))$bpz_activityRows=$bpz_activityApi->list($bpz_section);
        if($bpz_section==='my'||$bpz_section==='profile'){$bpz_entitlementRows=$bpz_activityApi->entitlements();$bpz_equipped=$bpz_activityApi->equipped();}
        if($bpz_section==='my')$bpz_activityHistory=$bpz_activityApi->history();
        if($bpz_section==='honor'&&$bpz_financialEnabled)$bpz_rankRows=$bpz_activityApi->rankings();
    }catch(DomainException $e){$bpz_activityError=true;$bpz_activityMessage='요청 조건을 확인해 주세요.';}
    catch(Throwable $e){$bpz_activityError=true;}
}
