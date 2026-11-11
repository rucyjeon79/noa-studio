"""Execute one host-authorized SQL text trial with ChatGPT subscription credentials."""
import hashlib,hmac,json,os,re,secrets,signal,subprocess,time,urllib.request
from pathlib import Path
from n80_codex_subscription_connect import Host,PRIVATE,ROOT,install_cli,clean_env,seal,unseal,dump

DISABLED=['shell_tool','apps','plugins','hooks','memories','browser_use','computer_use','fast_mode','ultrafast_mode']
SCHEMA={'type':'object','properties':{'text':{'type':'string'}},'required':['text'],'additionalProperties':False}

def signed(key,body):
    raw=dump(body).strip();ts=str(int(time.time()));nonce=secrets.token_hex(16)
    sig=hmac.new(key,('N80-HUB-1\n'+hashlib.sha256(raw).hexdigest()+'\n'+ts+'\n'+nonce).encode(),hashlib.sha256).hexdigest()
    req=urllib.request.Request('https://noastudio.ai.kr/noa-bridge/hub-worker.php',data=raw,headers={'Content-Type':'application/json','X-N80-Time':ts,'X-N80-Nonce':nonce,'X-N80-Signature':sig})
    with urllib.request.urlopen(req,timeout=30) as response:result=json.load(response)
    if result.get('ok') is not True:raise RuntimeError('host_operation_failed')
    return result

def parse_result(root):
    result=json.loads((root/'result.json').read_text())
    if set(result)!={'text'} or not isinstance(result['text'],str) or not 1<=len(result['text'].strip())<=2000:raise RuntimeError('result_invalid')
    usage=None;completed=0
    for line in (root/'events.jsonl').read_text(errors='replace').splitlines():
        try:e=json.loads(line)
        except ValueError:continue
        if e.get('type') in ('error','turn.failed'):raise RuntimeError('model_result_unconfirmed')
        item=e.get('item',{})
        if item.get('type') in ('command_execution','mcp_tool_call','web_search','file_change'):raise RuntimeError('unexpected_tool_execution')
        if e.get('type')=='turn.completed':completed+=1;usage=e.get('usage') or {}
    if completed!=1:raise RuntimeError('completion_event_unconfirmed')
    return result['text'],usage

def command(binary,root,model):
    args=[str(binary),'--no-daemon','-c','forced_login_method="chatgpt"','-c','model_provider="openai"',
          'exec','--ignore-user-config','--ephemeral','--json','--skip-git-repo-check','--sandbox','read-only',
          '--model',model,'--color','never','-c','approval_policy="never"','-c','web_search="disabled"',
          '-c','agents.enabled=false','-c','model_reasoning_effort="low"','--cd',str(root),
          '--output-schema',str(root/'schema.json'),'--output-last-message',str(root/'result.json')]
    for feature in DISABLED:args+=['--disable',feature]
    return args+['-']

def kill(process):
    if process is None or process.poll() is not None:return
    try:os.killpg(process.pid,signal.SIGTERM)
    except ProcessLookupError:return
    try:process.wait(timeout=3)
    except subprocess.TimeoutExpired:os.killpg(process.pid,signal.SIGKILL);process.wait(timeout=3)

def main():
    q=json.loads(Path('config/n80-codex-probe-request.json').read_text());run=os.environ['GITHUB_RUN_ID']
    if not re.fullmatch('[a-f0-9]{32}',q.get('requestId','')) or q.get('mode')!='single_trial' or q.get('apiFallback') is not False:raise RuntimeError('request_invalid')
    root=Path(os.environ['RUNNER_TEMP'])/'n80-codex-probe';root.mkdir(mode=0o700)
    auth=Path.home()/'.codex'/'auth.json'
    if auth.exists():raise RuntimeError('existing_runner_auth_preserved')
    claim=None;process=None;locked=False;auth_owned=False;old_cipher=None;vaultkey=None;worker_key=None;started=False
    try:
        with Host() as host:
            connection=json.loads(host.read('connection.json') or b'{}')
            if connection.get('state')!='authenticated' or not connection.get('vaultVerified'):raise RuntimeError('subscription_auth_required')
            # Verify only the two installed adapter files. Never deploy the repository over the site.
            for remote,local in [('noa-app/engine/codex.php','deploy/noa-app/engine/codex.php'),('noa-bridge/hub-worker.php','bridge/hub-worker.php')]:
                with host.s.open('/hosting/noastudio/html/'+remote,'rb') as f:actual=f.read(1048576)
                if actual!=Path(local).read_bytes():raise RuntimeError('host_adapter_changed')
            old=host.read('probe.json')
            if old is None:host.write('probe.json',dump(q),None)
            elif json.loads(old).get('requestId')!=q['requestId']:raise RuntimeError('previous_probe_preserved')
            with host.s.open('/hosting/noastudio/noa-ai-lab/worker.key','rb') as f:worker_key=f.read(256).strip()
            if not re.fullmatch(b'[a-f0-9]{64}',worker_key):raise RuntimeError('worker_key_invalid')
        identity={'requestId':q['requestId'],'runId':run}
        prior=signed(worker_key,{'action':'codex.read',**identity})
        if prior.get('task'):
            if prior['task']['state']!='succeeded':raise RuntimeError('prior_execution_requires_review')
            result={'ok':True,'cached':True,'generationInvocations':0,'task':prior['task']}
            Path('codex-proof').mkdir(exist_ok=True);Path('codex-proof/subscription-probe.json').write_bytes(dump(result));print(json.dumps(result,ensure_ascii=False));return
        with Host() as host:
            try:host.s.mkdir(PRIVATE+'/execution.lock',0o700)
            except OSError:raise RuntimeError('subscription_execution_busy')
            locked=True;old_cipher=host.read('chatgpt-auth.enc');vaultkey=host.read('auth-vault.key')
            if old_cipher is None or vaultkey is None:raise RuntimeError('auth_vault_missing')
            raw=unseal(old_cipher,vaultkey);value=json.loads(raw)
            if value.get('OPENAI_API_KEY') or not value.get('tokens'):raise RuntimeError('subscription_auth_required')
        auth.parent.mkdir(mode=0o700,exist_ok=True)
        with auth.open('xb') as f:os.chmod(auth,0o600);f.write(raw)
        auth_owned=True
        binary=install_cli(root)
        check=subprocess.run([str(binary),'--no-daemon','-c','forced_login_method="chatgpt"','login','status'],env=clean_env(),capture_output=True,text=True,timeout=20)
        if check.returncode or 'logged in using chatgpt' not in (check.stdout+check.stderr).lower():raise RuntimeError('subscription_auth_unverified')
        features=subprocess.run([str(binary),'--no-daemon','features','list'],env=clean_env(),capture_output=True,text=True,timeout=20)
        present={l.split()[0] for l in features.stdout.splitlines() if l.split()}
        if features.returncode or not set(DISABLED)<=present:raise RuntimeError('execution_controls_unavailable')
        (root/'schema.json').write_bytes(dump(SCHEMA))
        claim=signed(worker_key,{'action':'codex.claim',**identity})
        if claim.get('execute') is not True:raise RuntimeError('execution_already_claimed')
        prompt='텍스트 작성만 수행하세요. 도구를 사용하거나 실제 실행을 주장하지 마세요. 아래 N80 요청에 한국어로 짧게 답하고 지정된 JSON 형식을 반환하세요.\n'+claim['question']
        with (root/'events.jsonl').open('wb') as out,(root/'stderr.log').open('wb') as err:
            process=subprocess.Popen(command(binary,root,claim['model']),env=clean_env(),stdin=subprocess.PIPE,stdout=out,stderr=err,start_new_session=True)
            started=True
            try:process.communicate(prompt.encode(),timeout=claim['timeoutSeconds'])
            except subprocess.TimeoutExpired:kill(process);raise RuntimeError('model_timeout_unconfirmed')
        if process.returncode:raise RuntimeError('model_execution_failed')
        text,usage=parse_result(root);digest=hashlib.sha256(text.encode()).hexdigest()
        completion={'action':'codex.complete',**identity,'lease':claim['lease'],'text':text,'resultSha256':digest,'usage':usage}
        # A lost completion response is reconciled by reading the same SQL task, never by regenerating.
        try:receipt=signed(worker_key,completion)
        except Exception:
            receipt=signed(worker_key,{'action':'codex.read',**identity})
            if (receipt.get('task') or {}).get('resultSha256')!=digest:raise RuntimeError('host_result_unconfirmed')
        readback=signed(worker_key,{'action':'codex.read',**identity})
        replay=signed(worker_key,{'action':'codex.claim',**identity})
        if readback['task']['state']!='succeeded' or readback['task']['resultSha256']!=digest or replay.get('execute') is not False or replay['task']['resultSha256']!=digest:raise RuntimeError('host_readback_failed')
        result={'ok':True,'auth':'chatgpt','owner':'n80_hub','executor':'github_subordinate','generationInvocations':1,'duplicatePrevented':True,'apiFallback':False,'task':readback['task'],'workerActivated':False}
        Path('codex-proof').mkdir(exist_ok=True);Path('codex-proof/subscription-probe.json').write_bytes(dump(result));print(json.dumps(result,ensure_ascii=False))
    except Exception as e:
        kill(process)
        reason=str(e);reason=reason if re.fullmatch('[a-z_]{3,80}',reason) else 'probe_failed'
        if claim and claim.get('execute') and worker_key:
            try:signed(worker_key,{'action':'codex.failed','requestId':q['requestId'],'runId':run,'lease':claim['lease'],'reason':reason})
            except Exception:pass
        Path('codex-proof').mkdir(exist_ok=True);Path('codex-proof/subscription-probe.json').write_bytes(dump({'ok':False,'error':reason,'generationInvocations':int(started),'automaticRetry':False}))
        raise RuntimeError(reason) from None
    finally:
        kill(process)
        if locked:
            try:
                with Host() as host:
                    if auth_owned and auth.is_file():
                        refreshed=auth.read_bytes()
                        if refreshed!=unseal(old_cipher,vaultkey):host.write('chatgpt-auth.enc',seal(refreshed,vaultkey),old_cipher)
                    host.s.rmdir(PRIVATE+'/execution.lock')
            finally:
                if auth_owned and auth.is_file():auth.unlink()
        elif auth_owned and auth.is_file():auth.unlink()

if __name__=='__main__':
    def cancel(*_):raise RuntimeError('execution_cancelled')
    signal.signal(signal.SIGTERM,cancel)
    try:main()
    except Exception as e:print(json.dumps({'ok':False,'error':str(e) if re.fullmatch('[a-z_]{3,80}',str(e)) else 'probe_failed'}));raise SystemExit(1)
