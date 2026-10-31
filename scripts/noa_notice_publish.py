"""Publish the user-approved first guide through existing verified SFTP, then remove the helper."""
import base64,hashlib,json,os,secrets,sys,time,urllib.request,urllib.error
from pathlib import Path
import paramiko
from noa_full_inventory import ROOT,connect
from n80_live_observer import NoRedirect

def main():
    points='--points' in sys.argv
    amt='--amt' in sys.argv
    if amt:
        payload=Path('docs/notices/NOA_AMT2_SUPPORT.json').read_bytes()
    elif points:
        post=json.loads(Path('docs/notices/NOA_POINTS_FIELDGUIDE.json').read_text())
        post['image']=base64.b64encode(Path('deploy/noa-assets/guide/points-map.jpg').read_bytes()).decode()
        payload=json.dumps(post,ensure_ascii=False).encode()
    else:
        payload=Path('docs/notices/NOA_20261026_WELCOME.json').read_bytes()
        if json.loads(payload)['body']!=Path('docs/notices/NOA_20261026_WELCOME.html').read_text():raise RuntimeError('notice_source_mismatch')
    out=Path('points-proof' if points else 'notice-proof');out.mkdir(exist_ok=True)
    request=urllib.request.Request('https://api.github.com/repos/rucyjeon79/noa-studio/git/ref/heads/main',headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json'})
    with urllib.request.urlopen(request,timeout=25)as response:head=json.load(response)['object']['sha']
    if head!=os.environ['GITHUB_SHA']:raise RuntimeError('newer_main_preserved')
    token=secrets.token_hex(32);name='notice-publish-'+secrets.token_hex(12)+'.php';remote=ROOT+'/noa-bridge/'+name
    code=Path('scripts/noa_points_publish.php' if points else 'scripts/noa_notice_publish.php').read_text().replace('NOA_NOTICE_EXPIRY',str(int(time.time())+600)).replace('NOA_NOTICE_TOKEN_SHA',hashlib.sha256(token.encode()).hexdigest()).replace('NOA_NOTICE_PAYLOAD_SHA',hashlib.sha256(payload).hexdigest()).encode()
    transport=connect();installed=False;first=None;replay=None
    try:
        with paramiko.SFTPClient.from_transport(transport)as s:
            s.get_channel().settimeout(45)
            try:s.lstat(remote)
            except FileNotFoundError:pass
            else:raise RuntimeError('helper_collision')
            try:
                with s.open(remote,'wx')as f:f.write(code)
                installed=True;s.chmod(remote,0o644)
                with s.open(remote,'rb')as f:
                    if f.read()!=code:raise RuntimeError('helper_hash_mismatch')
                client=urllib.request.build_opener(NoRedirect())
                def publish():
                    req=urllib.request.Request('https://noastudio.ai.kr/noa-bridge/'+name,data=payload,headers={'Content-Type':'application/json','X-NOA-Control':token})
                    try:
                        with client.open(req,timeout=90)as r:raw=r.read(131073)
                    except urllib.error.HTTPError as error:
                        raw=error.read(131073)
                        try:reason=json.loads(raw).get('error','publication_failed')
                        except ValueError:reason='non_json_response'
                        raise RuntimeError('publication_failed:'+reason)from None
                    value=json.loads(raw)
                    if not value.get('ok'):raise RuntimeError('publication_not_verified')
                    return value
                first=publish();(out/'publication.json').write_text(json.dumps(first,ensure_ascii=False,indent=2))
                replay=publish()
                if replay['created']or first['id']!=replay['id']or first['bodySha256']!=replay['bodySha256']or first.get('noticeCount')!=replay.get('noticeCount'):raise RuntimeError('publication_not_idempotent')
            finally:
                if installed:
                    with s.open(remote,'rb')as f:
                        if f.read()!=code:raise RuntimeError('changed_helper_preserved')
                    s.remove(remote)
                    try:s.lstat(remote)
                    except FileNotFoundError:pass
                    else:raise RuntimeError('helper_cleanup_failed')
    finally:transport.close()
    receipt={**first,'sourceCommit':os.environ['GITHUB_SHA'],'samePostReplayVerified':True,'temporaryHelperRemoved':True}
    (out/'receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2));print('NOA_WELCOME_NOTICE_PUBLISHED',json.dumps(receipt,ensure_ascii=False))
if __name__=='__main__':main()
