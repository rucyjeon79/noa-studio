<?php
declare(strict_types=1);

/** N80 AI commander protocol. Uses the existing song/creative job and its lock. */
const N80_AGENT_VERSION = 1;
const N80_AGENT_LEASE_SECONDS = 240;
function n80_agent_contract(array $job=[]): array {
    return ['version'=>N80_AGENT_VERSION,'module'=>'ai_lab','brain'=>'ChatGPT',
        'execution'=>'existing_subscription_worker','maxDecisions'=>6,
        'tools'=>['song.read','result.validate','result.save'],
        'specialists'=>in_array('gemini_text',$job['agent']['specialists']??[],true)?[['id'=>'gemini_text','connected'=>true,'capabilities'=>['text_review'],'execution'=>'github_private_worker','imageGeneration'=>false,'videoGeneration'=>false]]:[], 'directFirst'=>true];
}
function n80_agent_claim(array &$job, array $body, ?int $now=null): array {
    if (($body['agentVersion']??null)!==N80_AGENT_VERSION) return [];
    $now??=time();
    $job['agent']=['version'=>N80_AGENT_VERSION,'lease'=>bin2hex(random_bytes(24)),
        'specialists'=>(is_array($body['specialists']??null)&&in_array('gemini_text',$body['specialists'],true)?['gemini_text']:[]),
        'seenAt'=>$now,'deadline'=>$now+480,'sequence'=>0,'phase'=>'planning',
        'checkpoint'=>['plan'=>[],'candidate'=>'','decisions'=>0,'observation'=>null]];
    return ['agentLease'=>$job['agent']['lease'],'agent'=>n80_agent_public($job)];
}
function n80_agent_public(array $job): array {
    $a=$job['agent']??[];
    return array_intersect_key($a,array_flip(['version','sequence','phase','deadline','checkpoint','validation','receipt']));
}
function n80_agent_resume(array &$job,array $body,?int $now=null): array {
    $now??=time();$a=$job['agent']??[];
    if (($body['agentVersion']??null)!==N80_AGENT_VERSION||empty($body['resume'])||!$a
        ||$now<=(int)$a['seenAt']+N80_AGENT_LEASE_SECONDS||$now>=(int)$a['deadline']
        ||in_array($a['phase'],['saved','failed'],true)) return [];
    $job['agent']['specialists']=(is_array($body['specialists']??null)&&in_array('gemini_text',$body['specialists'],true)?['gemini_text']:[]);
    $job['agent']['lease']=bin2hex(random_bytes(24));$job['agent']['seenAt']=$now;
    return ['id'=>$job['id'],'agentLease'=>$job['agent']['lease'],'agent'=>n80_agent_public($job)];
}
function n80_agent_assert(array $job,string $lease,?int $now=null): void {
    if (!isset($job['agent'])) return; // Compatibility for jobs already running during activation.
    $a=$job['agent'];$now??=time();
    if ($lease===''||!hash_equals($a['lease'],$lease)) throw new DomainException('agent_lease_conflict');
    if ($a['phase']!=='saved'&&($now>=(int)$a['deadline']||$now>(int)$a['seenAt']+N80_AGENT_LEASE_SECONDS))
        throw new DomainException('agent_deadline');
}
function n80_agent_candidate(array $job,string $text): void {
    if (!isset($job['agent'])) return;
    $a=$job['agent'];$hash=hash('sha256',$text);
    if (empty($a['validation']['valid'])||!hash_equals($a['validation']['hash']??'',$hash)
        ||($a['phase']!=='saved'&&!hash_equals(hash('sha256',$a['checkpoint']['candidate']??''),$hash)))
        throw new DomainException('agent_validation_required');
}
function n80_agent_checkpoint(array $body): array {
    $c=$body['checkpoint']??null;
    if (!is_array($c)||array_diff(array_keys($c),['plan','candidate','decisions','observation'])
        ||!is_array($c['plan']??null)||!array_is_list($c['plan'])||count($c['plan'])>8
        ||!is_string($c['candidate']??null)||strlen($c['candidate'])>800000
        ||!is_int($c['decisions']??null)||$c['decisions']<0||$c['decisions']>6)
        throw new InvalidArgumentException('invalid_agent_checkpoint');
    foreach($c['plan'] as $step) if(!is_string($step)||trim($step)===''||mb_strlen($step)>300)
        throw new InvalidArgumentException('invalid_agent_plan');
    $o=$c['observation']??null;
    if($o!==null&&(!is_array($o)||strlen(json_encode($o,JSON_THROW_ON_ERROR))>4000))
        throw new InvalidArgumentException('invalid_agent_observation');
    return $c;
}
/** The caller supplies the existing canonical validator; no model-defined handlers. */
function n80_agent_operation(array &$job,string $op,array $body,callable $validate): array {
    if(!isset($job['agent']))throw new DomainException('agent_not_claimed');
    n80_agent_assert($job,(string)($body['_agentLease']??''));
    $a=&$job['agent'];$a['seenAt']=time();
    if($op==='agentState')return ['contract'=>n80_agent_contract($job),'agent'=>n80_agent_public($job)];
    if($op==='agentCheckpoint'){
        $c=n80_agent_checkpoint($body);$seq=$body['sequence']??null;
        if(!is_int($seq))throw new InvalidArgumentException('invalid_agent_sequence');
        // An acknowledged write may be replayed after a lost response, with identical contents.
        if($seq===$a['sequence']-1&&$c===$a['checkpoint'])return ['agent'=>n80_agent_public($job)];
        if($seq!==$a['sequence']||$seq>=24||$c['decisions']<$a['checkpoint']['decisions'])
            throw new DomainException('agent_checkpoint_conflict');
        if($c['candidate']!==$a['checkpoint']['candidate'])unset($a['validation']);
        $a['checkpoint']=$c;$a['sequence']++;
        $a['phase']=$c['candidate']===''?'planning':'checking';
        return ['agent'=>n80_agent_public($job)];
    }
    if($op!=='agentValidate')throw new InvalidArgumentException('invalid_agent_operation');
    $text=$body['text']??null;
    if(!is_string($text)||trim($text)===''||$text!==$a['checkpoint']['candidate'])
        throw new InvalidArgumentException('agent_candidate_required');
    // Invalid content is feedback for the commander, not a terminal generation failure.
    try{$validate($text);$v=['valid'=>true,'errors'=>[]];}
    catch(InvalidArgumentException|DomainException|JsonException $e){
        $code=$e instanceof JsonException?'invalid_ai_json':$e->getMessage();
        $v=['valid'=>false,'errors'=>[preg_match('/^[a-z0-9_]{1,100}$/D',$code)?$code:'invalid_ai_output']];
    }
    $a['validation']=$v+['hash'=>hash('sha256',$text)];$a['phase']=$v['valid']?'reviewing':'revising';
    return ['validation'=>$v,'agent'=>n80_agent_public($job)];
}
function n80_agent_finish(array &$job,array $receipt): void {
    if(!isset($job['agent']))return;
    $job['agent']['phase']='saved';$job['agent']['receipt']=$receipt;
    // The canonical job owns the saved output; discard the duplicate working text.
    $job['agent']['checkpoint']['candidate']='';
}
