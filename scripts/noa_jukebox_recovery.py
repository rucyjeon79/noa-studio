"""Bounded signed-service retries and an observational worker watchdog.

No response bodies, signatures or credentials are copied to exceptions/logs.
The watchdog never cancels a workflow or terminates an audio process.
"""
import hashlib,hmac,json,re,secrets,time,urllib.request,urllib.error

class ServiceError(ValueError):
    pass

def signed_service(key,sleep=time.sleep):
    def call(action,payload=None):
        body={'action':action,'payload':json.loads(payload) if isinstance(payload,(str,bytes)) else payload or {}}
        raw=json.dumps(body,separators=(',',':')).encode()
        for attempt in range(3):
            ts=str(int(time.time()));nonce=secrets.token_hex(16)
            message='NOA-JUKEBOX-1\nPOST\n'+hashlib.sha256(raw).hexdigest()+'\n'+ts+'\n'+nonce
            headers={'Content-Type':'application/json','X-NOA-Timestamp':ts,'X-NOA-Nonce':nonce,'X-NOA-Signature':hmac.new(key.encode(),message.encode(),hashlib.sha256).hexdigest()}
            request=urllib.request.Request('https://noastudio.ai.kr/noa-app/jukebox/service.php',data=raw,headers=headers,method='POST')
            status=0;delay=0;reason='network_unavailable';retryable=True
            try:
                with urllib.request.urlopen(request,timeout=90) as response:
                    status=response.status
                    if 'json' not in response.headers.get('Content-Type',''):raise ServiceError('response_format_invalid')
                    try:result=json.load(response)
                    except (ValueError,UnicodeError):raise ServiceError('response_json_invalid') from None
                if not isinstance(result,dict) or not result.get('ok') or not isinstance(result.get('result'),dict):raise ServiceError('response_schema_invalid')
                return result['result']
            except urllib.error.HTTPError as error:
                status=error.code;reason='http_'+str(status);retryable=status in (408,429,500,502,503,504)
                retry_after=error.headers.get('Retry-After','')
                if retry_after.isdigit():delay=min(30,int(retry_after))
            except ServiceError as error:reason=str(error)
            except (OSError,TimeoutError):pass
            if not retryable or attempt==2:raise ServiceError('signed_'+action+'_'+reason) from None
            sleep(max(delay,2**attempt))
    return call

def run_state(run_id):
    if not re.fullmatch(r'[0-9]{1,32}',run_id):return 'unknown'
    request=urllib.request.Request('https://api.github.com/repos/rucyjeon79/noa-studio/actions/runs/'+run_id,headers={'Accept':'application/vnd.github+json','User-Agent':'NOA-JUKEBOX-watchdog'})
    try:
        with urllib.request.urlopen(request,timeout=20) as response:body=json.load(response)
        status=body.get('status')
        if status=='completed':return 'terminal'
        if status in ('queued','in_progress','waiting','pending','requested'):return 'running'
    except (OSError,ValueError):pass
    return 'unknown'

def watchdog(call,observe=run_state):
    health=call('runtime_health');observations=[]
    for run in sorted({str(j['worker_run_id']) for j in health['active_runs'] if j.get('worker_run_id')}):
        state=observe(run);call('worker_observation',{'run_id':run,'state':state});observations.append({'run_id':run,'state':state})
    result=call('maintenance')
    audit=call('audit');integrity=call('integrity_snapshot')
    return {'observations':observations,'maintenance':result,'files':{k:audit[k] for k in ['assets','covers','audio','audio_bytes','invalid']},'integrity':integrity,'processes_terminated':0}
