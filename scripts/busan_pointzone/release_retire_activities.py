"""Retire two unused Point Zone activities only. Preserve data and member sessions."""
import hashlib,hmac,json,secrets
from pathlib import Path
from urllib.request import Request,urlopen
import release_submenu_fix as remote
from release_native_catalog_admin import lint,response
BASE=Path('deploy/busan/youngcart/theme/Busan_PointZone')
FILES={
 'shop/index.php':'ff98350724b23dcda4d587c064028ed408abff9b',
 'activity-admin.php':'e61e6e29139f03a53e35099f00736a7d643988e0',
 'lib/activities-controller.php':'38b49974bb599e220340b9ea9c0a09622f41a00e',
 'lib/activities-view.php':'99804b83239ec1e7e4cc773c210720d1610fe5c7'
}
DESIRED=['포인트 상점','지부장 이벤트','프로필 꾸미기','명예의 전당','나의 포인트존']
def release(s):
    for path in (remote.ROOT,remote.THEME,remote.THEME+'/shop',remote.THEME+'/lib',remote.PRIVATE,remote.ROOT+'/busan-assistant'):remote.directory(s,path)
    plan=[]
    for rel,expected in FILES.items():
        new=(BASE/rel).read_bytes();lint(new)
        target=remote.THEME+'/'+rel;old=remote.read(s,target,100000)
        if old==new:continue
        if old is None or remote.blob(old)!=expected:raise RuntimeError('live version conflict: '+rel)
        backup=remote.PRIVATE+'/pointzone-retire-'+remote.digest(old)+'.bak'
        if remote.read(s,backup,100000) is None:remote.write(s,backup,old,0o600)
        if remote.read(s,backup,100000)!=old:raise RuntimeError('backup verification failed')
        plan.append((target,old,new))
    token=secrets.token_hex(32)
    code=Path('scripts/busan_pointzone/register_menu.php').read_text().replace('__TOKEN_HASH__',remote.digest(token.encode())).encode();lint(code)
    name='pointzone-menu-retire-'+secrets.token_hex(16)+'.php';dest=remote.ROOT+'/busan-assistant/'+name
    changed=[];menu_started=False
    def call(payload):
        req=Request('https://skhnslu-busan.com/busan-assistant/'+name,data=json.dumps(payload).encode(),headers={'X-Busan-Pointzone':token,'Content-Type':'application/json'})
        with urlopen(req,timeout=40) as r:return json.load(r)
    try:
        with s.open(dest,'wx') as f:f.write(code)
        s.chmod(dest,0o644)
        snapshot=call({'mode':'snapshot'})
        if snapshot.get('status')!='snapshot':raise RuntimeError('menu snapshot rejected: '+str(snapshot.get('reason','unknown')))
        digest=snapshot['sha256'];data=json.dumps(snapshot['snapshot'],ensure_ascii=False,separators=(',',':')).encode()
        if len(digest)!=64 or any(c not in '0123456789abcdef' for c in digest):raise RuntimeError('invalid snapshot hash')
        backup=remote.PRIVATE+'/pointzone-menu-'+digest+'.json'
        if remote.read(s,backup,100000) is None:remote.write(s,backup,data,0o600)
        if remote.read(s,backup,100000)!=data:raise RuntimeError('menu backup verification failed')
        for target,old,new in plan:
            if remote.read(s,target,100000)!=old:raise RuntimeError('concurrent edit')
            changed.append((target,old,new));remote.write(s,target,new,0o644)
        menu_started=True
        result=call({'mode':'apply','expected_sha256':digest})
        if result.get('status') not in ('applied','already_current') or result.get('submenus')!=DESIRED or not result.get('desktop') or not result.get('mobile'):
            raise RuntimeError('menu change not verified: '+str(result.get('reason','unknown')))
        print('BUSAN_POINTZONE_RETIRED_MENU',json.dumps(result,ensure_ascii=False),flush=True)
        for path in ('','theme/Busan_PointZone/pointzone.php?section=shop','theme/Busan_PointZone/pointzone.php?section=events','theme/Busan_PointZone/pointzone.php?section=profile'):
            status,body,_=response(path)
            if status>=500 or 'Fatal error' in body:raise RuntimeError('route error: '+path)
        print('BUSAN_POINTZONE_RETIRE_ACTIVITIES_OK',{'files_changed':len(changed),'five_menus':True,'point_mutations':0,'activity_records_deleted':0,'authenticated_render':'unverified'},flush=True)
    except Exception:
        # Once menu changes start, keep the retired features disabled even if
        # the menu verification needs a retry. Never reopen retired POST routes.
        if not menu_started:
            for target,old,new in reversed(changed):
                if remote.read(s,target,100000)!=new:raise RuntimeError('rollback conflict')
                remote.write(s,target,old,0o644)
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
