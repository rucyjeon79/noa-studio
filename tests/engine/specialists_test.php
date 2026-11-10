<?php
declare(strict_types=1);
/** Real specialist boundaries; no operating data, provider calls or payment execution. */
$root=dirname(__DIR__,2);
require_once $root.'/deploy/noa-app/engine/registry.php';
function specialist_expect(bool $ok,string $why):void {if(!$ok)throw new RuntimeException($why);}
$modules=noa_engine_modules();
foreach(['node','setup','install','lab','db','sign','pay']as $id) {
    specialist_expect(isset($modules[$id])&&$modules[$id]['owner']===$id,'owner:'.$id);
    foreach($modules[$id]['dependencies'] as $dependency)specialist_expect(isset($modules[$dependency]),'dependency:'.$id);
    foreach($modules[$id]['sources']as $source) {
        $file=str_starts_with($source,'noa-bridge/')?$root.'/bridge/'.substr($source,11):$root.'/deploy/'.$source;
        specialist_expect(is_file($file),'missing_source:'.$source);
    }
}
foreach(n80_module_aliases()as $old=>$id) {
    specialist_expect(!isset($modules[$old]),'duplicate_registration:'.$old);
    specialist_expect(n80_module($old)===n80_module($id),'alias:'.$old);
}
specialist_expect(n80_module('../../arbitrary')===null,'unknown_module');
foreach(get_included_files()as $file)
    specialist_expect(!in_array(basename($file),['db.php','pay.php','sign.php','lab.php','node.php','install.php'],true),'eager_implementation:'.$file);
require_once $root.'/bridge/member-access.php';
specialist_expect(!nam_access(['mb_id'=>'staff','mb_level'=>10])['admin'],'numeric_admin_escalation');
specialist_expect(nam_access(['mb_id'=>'admin','mb_level'=>10],'super')['admin'],'super_admin_lost');
specialist_expect(!nam_owner(['ownerId'=>'one'],['mb_id'=>'two']),'cross_owner');
specialist_expect(nam_requirement('/noa-ai-lab.php','GET',['tool'=>'settings'])==='admin','settings_permission');
specialist_expect((new ReflectionFunction('n80_sign_access'))->getFileName()===$root.'/deploy/noa-app/engine/sign.php','sign_owner');
require_once $root.'/deploy/noa-app/engine/pay.php';
$catalog=['vip'=>['price'=>100,'points'=>0,'plan'=>'vip','days'=>30,'source'=>'vip','orderable'=>true]];
$benefits=n80_pay_benefits($catalog,[['id'=>'vip','quantity'=>1,'price'=>100]]);
specialist_expect($benefits['amount']===100&&$benefits['days']===30,'real_server_quote');
try{n80_pay_benefits($catalog,[['id'=>'vip','quantity'=>1,'price'=>1]]);throw new RuntimeException('price_tamper_accepted');}catch(DomainException $expected){}
$quote=['mode'=>'live','owner'=>'one','order'=>'1000000000','benefits'=>$benefits];
$paid=['mb_id'=>'one','od_id'=>'1000000000','od_pg'=>'kcp','od_status'=>'입금','od_tno'=>'12345678901234','od_receipt_price'=>100,'od_receipt_point'=>0,'od_cancel_price'=>0,'od_misu'=>0];
n80_pay_validate_paid($paid,$quote);
foreach(['mb_id'=>'two','od_receipt_price'=>1,'od_pg'=>'other','od_cancel_price'=>100]as $key=>$bad) {
    try{n80_pay_validate_paid(array_replace($paid,[$key=>$bad]),$quote);throw new RuntimeException('unverified_payment:'.$key);}catch(DomainException $expected){}
}
require_once $root.'/deploy/noa-app/engine/app-lifecycle.php';
specialist_expect(n80_app_update_status($root.'/nonexistent')===n80_install_update_status($root.'/nonexistent'),'install_delegation');
require_once $root.'/deploy/noa-app/engine/node.php';
specialist_expect(n80_node_installation_status($root.'/nonexistent')['runtimeHealth']==='not_checked','fabricated_node_health');
$automation=json_decode(file_get_contents($root.'/config/n80-automation.json'),true,512,JSON_THROW_ON_ERROR);
specialist_expect($automation['runtimes']['node']['operations']===n80_node_contract()['operations'],'node_contract_drift');
specialist_expect($automation['runtimes']['node']['module']==='node','node_execution_owner');
specialist_expect($automation['operations']['engine.node_install']['module']==='install','install_execution_owner');
foreach($automation['operations']as $operation)specialist_expect(isset($modules[$operation['module']]),'automation_owner');
specialist_expect(array_column(n80_workspaces(),'label')===['홈페이지 설정','CREATOR LAB','AI LAB'],'menu_changed');
echo "N80_SPECIALISTS_OK canonical owners, real sign/pay checks, aliases, no eager execution\n";
