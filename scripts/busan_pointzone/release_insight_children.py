"""Release independent Hall of Fame navigation only. Keep login and points unchanged."""
import hmac,json,secrets
from pathlib import Path
from urllib.request import Request,urlopen
import release_submenu_fix as remote
from release_native_catalog_admin import lint,response
BASE=Path('deploy/busan/youngcart/theme/Busan_PointZone')
FILES={}
def release(s):
    for path in (remote.ROOT,remote.THEME,remote.THEME+'/shop',remote.PRIVATE,remote.ROOT+'/busan-assistant'):remote.directory(s,path)
    plan=[]
    for rel,expected in FILES.items():
        new=(BASE/rel).read_bytes();lint(new)
        target=remote.THEME+'/'+rel;old=remote.read(s,target,100000)
        if old==new:continue
        if remote.blob(old)!=expected:raise RuntimeError('live version conflict: '+rel)
        if old is not None:
            backup=remote.PRIVATE+'/pointzone-honor-'+remote.digest(old)+'.bak'
            if remote.read(s,backup,100000) is None:remote.write(s,backup,old,0o600)
            if remote.read(s,backup,100000)!=old:raise RuntimeError('backup verification failed')
        plan.append((target,old,new))
    token=secrets.token_hex(32)
    code=Path('scripts/busan_pointzone/repair_insight_children.php').read_text().replace('__TOKEN_HASH__',remote.digest(token.encode())).encode();lint(code)
    name='insight-hierarchy-'+secrets.token_hex(16)+'.php';dest=remote.ROOT+'/busan-assistant/'+name
    changed=[];menu_started=False
    def call(payload):
        req=Request('https://skhnslu-busan.com/busan-assistant/'+name,data=json.dumps(payload).encode(),headers={'X-Busan-Pointzone':token,'Content-Type':'application/json'})
        with urlopen(req,timeout=40) as r:return json.load(r)
    try:
        for target,old,new in plan:
            if remote.read(s,target,100000)!=old:raise RuntimeError('concurrent edit')
            changed.append((target,old,new));remote.write(s,target,new,0o644)
        with s.open(dest,'wx') as f:f.write(code)
        s.chmod(dest,0o644)
        snapshot=call({'mode':'snapshot'})
        if snapshot.get('status')!='snapshot':raise RuntimeError('menu snapshot rejected: '+str(snapshot.get('reason','unknown')))
        digest=snapshot['sha256'];data=json.dumps(snapshot['rows'],ensure_ascii=False,separators=(',',':')).encode()
        if len(digest)!=64 or any(c not in '0123456789abcdef' for c in digest):raise RuntimeError('invalid snapshot hash')
        backup=remote.PRIVATE+'/insight-hierarchy-backup-'+digest+'.json'
        if remote.read(s,backup,100000) is None:remote.write(s,backup,data,0o600)
        if remote.read(s,backup,100000)!=data:raise RuntimeError('menu backup verification failed')
        print('BUSAN_HONOR_MENU_BEFORE',json.dumps([r['me_name'] for r in snapshot['rows'] if len(r['me_code'])==2],ensure_ascii=False),flush=True)
        menu_started=True
        result=call({'mode':'apply','expected_sha256':digest})
        if result.get('status')!='applied':raise RuntimeError('menu change not verified: '+str(result.get('reason','unknown')))
        print('BUSAN_INSIGHT_HIERARCHY_VERIFIED',json.dumps(result,ensure_ascii=False),flush=True)
        for path in ('','?device=pc','?device=mobile','bbs/board.php?bo_table=busan_news','note'):
            status,body,_=response(path)
            if status>=500 or 'Fatal error' in body:raise RuntimeError('route error: '+path)
            if path in ('','?device=pc','?device=mobile'):
                # The native navigation should now render the entire Insight group in sequence.
                labels=['OpenAI 인사이트','회사·그룹 소식','노동조합 소식','노동법·판례','세계 노동 동향','권리노트']
                start=body.find(labels[0]);cursor=start
                for label in labels[1:]:
                    cursor=body.find(label,cursor+1) if cursor>=0 else -1
                if cursor<0:raise RuntimeError('rendered Insight order not verified: '+path)
                print('BUSAN_INSIGHT_RENDER_ORDER_OK',path or '/',flush=True)
        print('BUSAN_INSIGHT_HIERARCHY_RELEASE_OK',{'files_changed':len(changed),'point_mutations':0,'authenticated_render':'unverified','voting':'not_enabled'},flush=True)
    except Exception:
        if not menu_started:
            for target,old,new in reversed(changed):
                if remote.read(s,target,100000)!=new:raise RuntimeError('rollback conflict')
                if old is None:s.remove(target)
                else:remote.write(s,target,old,0o644)
        raise
    finally:
        try:s.remove(dest)
        except FileNotFoundError:pass
if __name__=='__main__':
    host,user,password,pin=remote.configuration(remote.os.environ)
    with remote.socket.create_connection((host,remote.PORT),timeout=15) as sock,remote.paramiko.Transport(sock) as t:
        t.get_security_options().key_types=('ssh-ed25519',);t.start_client(timeout=20)
        if not hmac.compare_digest(remote.fingerprint(t.get_remote_server_key()),pin):raise RuntimeError('host identity mismatch')
        t.auth_password(user,password,fallback=False)
        with remote.paramiko.SFTPClient.from_transport(t) as s:
            s.get_channel().settimeout(35);release(s)
