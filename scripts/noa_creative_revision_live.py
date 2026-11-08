"""Read the reported edit, then verify one unpublished edit through the existing N80 worker."""
import hashlib,json,os,re,secrets,time,urllib.request,urllib.error
from pathlib import Path
import paramiko
from noa_full_inventory import ROOT,connect
from n80_live_observer import NoRedirect

def main(phase):
    if phase not in ('audit','verify','cleanup'):raise ValueError('invalid phase')
    audit_id=os.environ.get('NOA_CREATIVE_AUDIT_JOB','')
    if audit_id and not re.fullmatch('[a-f0-9]{32}',audit_id):raise ValueError('invalid audit job')
    probe_id=os.environ.get('NOA_CREATIVE_PROBE_ID','') if phase=='cleanup' else secrets.token_hex(16)
    request_id=os.environ.get('NOA_CREATIVE_PROBE_REQUEST','') if phase=='cleanup' else secrets.token_hex(16)
    if not all(re.fullmatch('[a-f0-9]{32}',value) for value in (probe_id,request_id)):raise ValueError('invalid probe identity')
    token=secrets.token_hex(32);name='creative-revision-'+secrets.token_hex(12)+'.php';remote=ROOT+'/noa-bridge/'+name
    code=Path('scripts/noa_creative_revision_live.php').read_text()
    for k,v in {'__AUDIT_JOB_ID__':audit_id,'__EXPIRY__':str(int(time.time())+900),'__TOKEN_SHA__':hashlib.sha256(token.encode()).hexdigest(),'__DRAFT_ID__':probe_id,'__REQUEST_ID__':request_id}.items():code=code.replace(k,v)
    code=code.encode();t=connect();installed=False;created=False;receipt={};opener=urllib.request.build_opener(NoRedirect())
    def call(op):
        request=urllib.request.Request('https://noastudio.ai.kr/noa-bridge/'+name,data=json.dumps({'op':op}).encode(),headers={'Content-Type':'application/json','X-NOA-Control':token,'Cache-Control':'no-cache'})
        try:
            with opener.open(request,timeout=45) as response:data=json.load(response)
        except urllib.error.HTTPError as error:
            try:data=json.load(error)
            except Exception:raise RuntimeError('revision_probe_http_'+str(error.code))
        if not data.get('ok'):raise RuntimeError('revision_probe_'+op+':'+str(data.get('error')))
        return data['result']
    try:
        with paramiko.SFTPClient.from_transport(t) as s:
            s.get_channel().settimeout(30)
            with s.open(remote,'wx') as f:f.write(code)
            installed=True;s.chmod(remote,0o644)
            with s.open(remote,'rb') as f:
                if f.read()!=code:raise RuntimeError('revision_probe_readback')
        if phase=='audit':receipt=call('audit');print('CREATIVE_REVISION_AUDIT',json.dumps(receipt,ensure_ascii=False),flush=True)
        elif phase=='cleanup':
            receipt['cleanup']=call('cleanup');print('CREATIVE_REVISION_PROBE_CLEANED',json.dumps(receipt),flush=True)
        else:
            created=True;receipt['submitted']=call('init')
            for attempt in range(120):
                status=call('status')
                if status['state']=='succeeded':break
                if status['state'] in ('failed','review','canceled'):raise RuntimeError('revision_probe_failed:'+str(status))
                if attempt%6==0:print('CREATIVE_REVISION_WAIT',status['state'],flush=True)
                time.sleep(5)
            else:raise RuntimeError('revision_probe_timeout')
            receipt['inference']=status;value=status['result']
            if not (status['submittedTitle']==status['currentTitle']=='A Song Between the Lines' and status['request']=='더 짧게 줄여죠' and value==status['proposal'] and isinstance(value,str) and 0<len(value)<len(status['currentTitle']) and re.search('[A-Za-z]',value) and not re.search('[가-힣]',value)):
                raise RuntimeError('revision_latest_english_shortening_failed')
            print('CREATIVE_REVISION_REAL_AI_VERIFIED',json.dumps(status,ensure_ascii=False),flush=True)
    finally:
        if created:
            try:receipt['cleanup']=call('cleanup')
            except Exception as error:receipt['cleanupError']=str(error)
        if installed:
            with paramiko.SFTPClient.from_transport(t) as s:
                with s.open(remote,'rb') as f:
                    if f.read()!=code:raise RuntimeError('concurrent_probe_preserved')
                s.remove(remote)
        t.close();out=Path('ainoa-proof');out.mkdir(exist_ok=True);(out/('creative-revision-'+phase+'.json')).write_text(json.dumps(receipt,ensure_ascii=False,indent=2))

    if receipt.get('cleanupError'):raise RuntimeError('revision_probe_cleanup_failed')

if __name__=='__main__':
    import sys
    main(sys.argv[1])
