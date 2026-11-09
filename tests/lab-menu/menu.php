<?php
declare(strict_types=1);
require dirname(__DIR__,2).'/deploy/noa-app/engine/workspaces.php';
require dirname(__DIR__,2).'/bridge/member-access.php';
function verify(bool $ok,string $why):void {if(!$ok)throw new RuntimeException($why);}
$tools=n80_lab_tools();
verify(count($tools)===13,'Existing contextual tools plus the hidden browser connection');
verify(($tools['browser']['hidden']??false)===true&&$tools['browser']['access']==='admin','Browser connection must remain administrator-only');
$excluded=['text','song','channel','muvy','settings','browser'];
foreach(['admin'=>10,'creator'=>8,'member'=>3,'guest'=>1] as $role=>$level){
    $access=nam_access($level>1?['mb_id'=>'test','mb_level'=>$level]:[],$role==='admin'?'super':'');
    $expected=$role==='admin'?['creative','batch','create','chat','jobs','growth']:($role==='guest'?[]:($role==='creator'?['creative','chat']:['chat']));
    $menu=array_filter(n80_lab_menu_tools($access),fn($tool)=>!empty($access[$tool['access']]));
    verify(array_keys($menu)===$expected,'Standalone menu for '.$role);
    ob_start();n80_workspace_render('ai_lab',$access);$hub=ob_get_clean();
    verify(substr_count($hub,'<small>')===count($expected),'Description below every menu for '.$role);
    foreach($excluded as $id)verify(!str_contains($hub,'?tool='.$id.'"'),'Contextual tool duplicated in hub: '.$id);
    foreach($tools as $current=>$tool){
        if(empty($access[$tool['access']]))continue;
        ob_start();n80_lab_nav($access,$current);$nav=ob_get_clean();
        preg_match('~<div class="lab-tool-links">(.*?)</div>~s',$nav,$match);
        foreach($excluded as $id)verify(!str_contains($match[1]??'','?tool='.$id.'"'),'Contextual tool duplicated in switcher: '.$id);
        verify(str_contains($nav,'data-n80-tool-description'),'Active tool explanation: '.$current);
        if(in_array($current,['chat','listen'],true)){
            verify(str_contains($nav,'?tool=chat"')&&str_contains($nav,'?tool=listen"'),'Both conversation modes reachable');
            verify(str_contains($nav,'data-n80-lab-modes="conversation"'),'Conversation uses one shared menu');
        }
        if($current==='create')verify(!str_contains($nav,'?tool=muvy"'),'Song-info music video launcher is not duplicated');
    }
}
echo "AI_LAB_CONTEXT_EXCLUSION_DESCRIPTIONS_AND_ROLES_OK\n";
