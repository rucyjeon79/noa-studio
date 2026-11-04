<?php
declare(strict_types=1);
require dirname(__DIR__,2).'/bridge/listening-care-core.php';
function expect(bool $yes):void{if(!$yes)throw new RuntimeException('VIP care contract');}
$s=['jobs'=>[]];$id=str_repeat('a',32);$payload=['note'=>'테스트','tracks'=>[['key'=>'a','title'=>'가'],['key'=>'b','title'=>'나']]];
expect(nwc_enqueue($s,$id,'one',$payload)[0]);
expect(!nwc_enqueue($s,$id,'one',$payload)[0]);
try{nwc_enqueue($s,str_repeat('b',32),'one',$payload);expect(false);}catch(DomainException $e){expect($e->getMessage()==='pending');}
try{nwc_enqueue($s,$id,'two',$payload);expect(false);}catch(DomainException $e){expect($e->getMessage()==='missing');}
$yes=fn($owner)=>$owner==='one';
$r=nwc_worker($s,$id,'claim',[],$yes);expect(!isset($r['job']['owner'],$r['job']['tracks'][0]['key']));expect(!isset($s['jobs'][$id]['payload']));
expect(!isset(nwc_worker($s,$id,'claim',[],$yes)['job']));
try{nwc_worker($s,$id,'save',['message'=>'곡','order'=>[27]],$yes);expect(false);}catch(DomainException $e){}
nwc_worker($s,$id,'save',['message'=>'들어 보세요.','order'=>[1,0]],$yes);expect(nwc_public($s['jobs'][$id])['keys']===['b','a']);
nwc_worker($s,$id,'fail',['reason'=>'quota'],$yes);expect($s['jobs'][$id]['state']==='ready');
$s=['jobs'=>[]];nwc_enqueue($s,$id,'one',$payload);nwc_worker($s,$id,'claim',[],fn()=>false);expect(!isset($s['jobs'][$id]));
nwc_enqueue($s,$id,'one',$payload);nwc_worker($s,$id,'claim',[],$yes);nwc_worker($s,$id,'fail',['reason'=>'quota'],$yes);
try{nwc_enqueue($s,str_repeat('c',32),'two',$payload);expect(false);}catch(DomainException $e){expect($e->getMessage()==='quota');}
echo "VIP_CARE_OWNERSHIP_IDEMPOTENCE_EXPIRY_QUOTA_OK\n";
