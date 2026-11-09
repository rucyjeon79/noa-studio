<?php
require __DIR__.'/../../deploy/noa-app/engine/agent-runtime.php';
function acheck($yes,$name){if(!$yes)throw new RuntimeException($name);}
function adenied(callable $fn,string $code){try{$fn();}catch(Throwable $e){acheck($e->getMessage()===$code,'wrong error '.$e->getMessage());return;}throw new RuntimeException('expected '.$code);}
$job=['id'=>str_repeat('a',32)];$claim=n80_agent_claim($job,['agentVersion'=>1]);$lease=$claim['agentLease'];
acheck(n80_agent_contract()['brain']==='ChatGPT'&&n80_agent_contract()['specialists']===[],'truthful capability inventory');
adenied(fn()=>n80_agent_assert($job,'wrong'),'agent_lease_conflict');
$body=['_agentLease'=>$lease,'sequence'=>0,'checkpoint'=>['plan'=>['Write the selected title'],'candidate'=>'invalid','decisions'=>1,'observation'=>null]];
$invalid=function($text){if($text==='invalid')throw new DomainException('invalid_text');};
n80_agent_operation($job,'agentCheckpoint',$body,$invalid);
n80_agent_operation($job,'agentCheckpoint',$body,$invalid);acheck($job['agent']['sequence']===1,'lost checkpoint is idempotent');
$conflict=$body;$conflict['checkpoint']['candidate']='changed';adenied(fn()=>n80_agent_operation($job,'agentCheckpoint',$conflict,$invalid),'agent_checkpoint_conflict');
$v=n80_agent_operation($job,'agentValidate',['_agentLease'=>$lease,'text'=>'invalid'],$invalid);
acheck(!$v['validation']['valid']&&$job['agent']['phase']==='revising','validator returns repair feedback');
adenied(fn()=>n80_agent_candidate($job,'invalid'),'agent_validation_required');
$body['sequence']=1;$body['checkpoint']['candidate']='valid';$body['checkpoint']['decisions']=2;
n80_agent_operation($job,'agentCheckpoint',$body,$invalid);
adenied(fn()=>n80_agent_candidate($job,'valid'),'agent_validation_required');
n80_agent_operation($job,'agentValidate',['_agentLease'=>$lease,'text'=>'valid'],$invalid);n80_agent_candidate($job,'valid');
adenied(fn()=>n80_agent_candidate($job,'different'),'agent_validation_required');
$now=time();$job['agent']['seenAt']=$now-241;
$resumed=n80_agent_resume($job,['agentVersion'=>1,'resume'=>true],$now);
acheck($resumed['agentLease']!==$lease&&$resumed['agent']['checkpoint']['candidate']==='valid','resume keeps candidate and fences old process');
adenied(fn()=>n80_agent_assert($job,$lease),'agent_lease_conflict');
acheck(n80_agent_resume($job,['agentVersion'=>1,'resume'=>true],$now)===[],'active execution cannot be stolen');
n80_agent_finish($job,['saved'=>true,'revision'=>2]);n80_agent_candidate($job,'valid');
acheck($job['agent']['checkpoint']['candidate']===''&&$job['agent']['receipt']['revision']===2,'real receipt owns completion, duplicate text released');
echo "N80_AGENT_PROTOCOL_FENCING_REPAIR_RECEIPT_OK\n";

$special=['id'=>str_repeat('d',32)];
n80_agent_claim($special,['agentVersion'=>1,'specialists'=>['gemini_text','fake_video']]);
$inventory=n80_agent_contract($special)['specialists'];
acheck(count($inventory)===1&&$inventory[0]['id']==='gemini_text'&&!$inventory[0]['imageGeneration']&&!$inventory[0]['videoGeneration'],'only verified installed text specialist');
$special['agent']['seenAt']=time()-241;
n80_agent_resume($special,['agentVersion'=>1,'resume'=>true]);
acheck(n80_agent_contract($special)['specialists']===[],'replacement runner must reverify Gemini');
