"""Guarded native bootstrap hooks delegate continuity to N80; credentials stay native."""
import hashlib,sys
from pathlib import Path
import paramiko
import noa_ainoa_deploy as release
from noa_full_inventory import ROOT,connect

HOOK="\n// N80 owns session storage and response cookies; native authentication follows.\nrequire_once __DIR__.'/noa-app/engine/session-policy.php';\nn80_session_bootstrap();\n"
PATCHES={
 'common.php':('1c7aec0d6dee688077a4ac30fa703bdf93cbd49b77f922d6a8e963c97dacdf62','chrome_domain_session_name();','chrome_domain_session_name();'+HOOK),
 'extend/social_login.extend.php':('4978fa3f31b4bcda7c5453e065f3c072c37c5fa5d37520effbb7e0f12f0d1d7b',"define('G5_SOCIAL_USE_POPUP', ! is_mobile() );","define('G5_SOCIAL_USE_POPUP', n80_session_use_popup());"),
}
def prepare():
 out=Path('login-proof');out.mkdir(exist_ok=True)
 t=connect()
 try:
  with paramiko.SFTPClient.from_transport(t) as s:
   s.get_channel().settimeout(30)
   for remote,(expected,old,new) in PATCHES.items():
    target=out/('native-'+remote.replace('/','-'))
    if 'rollback' in sys.argv and target.exists():raw=target.read_bytes()
    else:
     with s.open(ROOT+'/'+remote,'rb') as f:raw=f.read()
    source=raw.decode();base=source.replace(new,old)
    if hashlib.sha256(base.encode()).hexdigest()!=expected or base.count(old)!=1:raise RuntimeError('native_preimage_changed:'+remote)
    candidate=base.replace(old,new).encode();target.write_bytes(candidate)
    release.FILES[remote]=str(target)
    release.EXTRA_KNOWN[remote]=[expected,hashlib.sha256(candidate).hexdigest()]
 finally:t.close()
release.FILES={'noa-app/engine/registry.php':'deploy/noa-app/engine/registry.php','noa-app/engine/session-policy.php':'deploy/noa-app/engine/session-policy.php','noa-login.php':'deploy/noa-login.php'}
release.NEW={'noa-app/engine/session-policy.php'}
release.PROTECTED=[p for p in release.PROTECTED if p not in PATCHES]
release.PROTECTED+=['bbs/logout.php','extend/zz.noa-social.php','noa-bridge/social-policy.php']
if __name__=='__main__':
 prepare();release.main()
