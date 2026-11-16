#!/usr/bin/env python3
"""Read-only, pinned SFTP test of current N80 external adapter PHP.
Runs tests in a GitHub runner temp dir, never through production PHP/DB.
"""
import base64,hashlib,os,stat,subprocess,tempfile
from pathlib import Path
import paramiko
PIN='SHA256:0LqxbpOziJ4XgOMNEkfVrVGle3kpjJessI+jKqZ4JCU'
WEB='/hosting/noastudio/html'
SOURCES={
 'one-shot-adapter.php':'3b126e2b4dcdb97810bb5cd45ddb355596042f43a3424aa76c37457b18d5bd9d',
 'lowload-transition.php':'ecd82dec6ac731dfcd28c0dabc626c90ca342500d5820b8bc2ee040022c4ed51',
 'lease-inbox.php':'9af7a7356f786faf86f6e20f319d3d474a647b472f72009d65c9704d54a33d0d',
 'host-load-policy.php':'119cfcbdeaa031134fe07ab55c66aa5c02090f7196b5485df186297b0ed6cb55',
 'one-shot-preflight.php':'b56f2c507238fa08ac2c269ecedc6068bfbd85e9b7123f083ad71567a4abc138'
}
PHP=r'''<?php
declare(strict_types=1);
require __DIR__.'/one-shot-preflight.php';
function prove(bool $ok,string $name):void {if(!$ok)throw new RuntimeException($name);}
$now=1000000;
$ops=[
 ['id'=>'hub.verify','last'=>['state'=>'succeeded']],
 ['id'=>'ai.batch','last'=>['state'=>'running','id'=>str_repeat('b',32),'startedAt'=>999000]]
];
$task=['operation'=>'hub.verify','taskId'=>str_repeat('a',32),'maxItems'=>1];
$a=n80_external_one_shot_preview($task,$ops,$now);
$b=n80_external_one_shot_preview($task,$ops,$now);
prove($a['ok']===true,'valid_planning');
prove($a['executionAllowed']===false&&!$a['dispatchPerformed']&&$a['hostWrites']===0,'zero_side_effects');
prove($a['idempotencyKey']===$b['idempotencyKey'],'deterministic_idempotency');
prove($a['maxItems']===1&&$a['maxConcurrency']===1,'bounded_budget');
prove($a['leasePreview']['generation']===1,'existing_lease_fencing');
$over=$task;$over['maxItems']=6;
prove(n80_external_one_shot_preview($over,$ops,$now)['reason']==='invalid_external_envelope','batch_limit');
$bad=$task;$bad['taskId']='not-an-id';
prove(n80_external_one_shot_preview($bad,$ops,$now)['reason']==='invalid_external_envelope','id_validation');
$unknown=$task;$unknown['operation']='unsupported.run';
prove(n80_external_one_shot_preview($unknown,$ops,$now)['reason']==='invalid_external_envelope','allowlist');
$batch=$task;$batch['operation']='ai.batch';
prove(n80_external_one_shot_preview($batch,$ops,$now)['reason']==='previous_execution_unconfirmed','unconfirmed_replay_block');
$foreign=noa_engine_lease_new(str_repeat('f',32),'hub.verify');
prove(n80_external_one_shot_preview($task,$ops,$now,$foreign)['reason']==='lease_identity_mismatch','fenced_identity');
$done=noa_engine_lease_new($task['taskId'],'hub.verify');$done['status']='succeeded';
prove(str_starts_with(n80_external_one_shot_preview($task,$ops,$now,$done)['reason'],'lease_'),'terminal_claim_reject');
$r=n80_external_one_shot_readiness($ops,['stop'=>true,'paused'=>true]);
prove($r['mode']==='plan_only'&&$r['legacyStop']&&$r['legacyPaused'],'paused_preview');
prove(!$r['liveDispatchAllowed']&&!$r['externalQueueActive'],'external_not_activated');
prove(count($r['unconfirmedReceipts'])===1&&$r['unconfirmedReceipts'][0]['operation']==='ai.batch','pending_receipt_visible');
$external=n80_external_one_shot_preflight($task,$ops,['stop'=>true,'paused'=>true],$now);
prove($external['reason']==='external_worker_not_activated','paused_host_is_not_external_blocker');
prove($external['legacyRunnerSuspended']===true,'legacy_runner_stays_stopped');
prove(!in_array('host_legacy_runner_not_suspended',$external['blockers'],true),'separate_control_planes');
$unpaused=n80_external_one_shot_preflight($task,$ops,['stop'=>false,'paused'=>true],$now);
prove($unpaused['reason']==='host_legacy_runner_not_suspended','unpaused_host_is_unsafe');
prove(!$external['executionAllowed']&&!$external['dispatchPerformed']&&$external['hostWrites']===0,'external_still_disabled');
echo "N80_ONESHOT_CONTRACT_PASS tests=19 dispatches=0 host_writes=0\n";
''';
connection=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022))
try:
 connection.get_security_options().key_types=('ssh-ed25519',)
 connection.start_client(timeout=20)
 server=connection.get_remote_server_key()
 fp='SHA256:'+base64.b64encode(hashlib.sha256(server.asbytes()).digest()).decode().rstrip('=')
 if fp!=PIN:raise RuntimeError('Host identity mismatch')
 connection.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD'])
 sftp=paramiko.SFTPClient.from_transport(connection)
 sftp.get_channel().settimeout(30)
 if sftp.normalize(WEB)!=WEB:raise RuntimeError('Unexpected host source path')
 with tempfile.TemporaryDirectory(prefix='n80-local-simulation-') as tmp:
  for name,digest in SOURCES.items():
   source=WEB+'/noa-app/engine/'+name
   st=sftp.lstat(source)
   if not stat.S_ISREG(st.st_mode) or st.st_size>12000:raise RuntimeError('Source size invalid '+name)
   with sftp.open(source,'rb') as stream:bytes_=stream.read(12001)
   if hashlib.sha256(bytes_).hexdigest()!=digest:raise RuntimeError('Source changed '+name)
   local=Path(tmp,name);local.write_bytes(bytes_)
   subprocess.run(['php','-l',str(local)],check=True,stdout=subprocess.DEVNULL,timeout=10)
  localtest=Path(tmp,'proof.php');localtest.write_text(PHP,encoding='utf-8')
  completed=subprocess.run(['php',str(localtest)],capture_output=True,text=True,timeout=10,check=True)
  print(completed.stdout.strip())
finally:
 connection.close()
