"""Read-only audit of native login lifecycle; never reads member/session contents."""
import json,re,hashlib
import paramiko
from noa_full_inventory import ROOT,connect

def main():
 t=connect()
 try:
  with paramiko.SFTPClient.from_transport(t) as s:
   s.get_channel().settimeout(30)
   names=s.listdir(ROOT+'/extend');print('EXTENSIONS',json.dumps(names))
   paths=['common.php','bbs/login.php','bbs/login_check.php','bbs/logout.php','plugin/social/includes/functions.php','plugin/social/includes/config.php','plugin/social/index.php','plugin/social/Hybrid/Auth.php']
   paths += ['extend/'+n for n in names if any(w in n.lower() for w in ['social','session','cookie','login'])]
   for path in paths:
    try:
     with s.open(ROOT+'/'+path,'rb') as f:raw=f.read()
    except FileNotFoundError:continue
    lines=raw.decode('utf-8','replace').splitlines();indices=set()
    for i,line in enumerate(lines):
     if re.search(r'session|ss_mb_|auto_login|set_cookie|HTTP_USER_AGENT|REMOTE_ADDR|redirect_to_idp|opener|window.close|goto_url|social_login_success',line,re.I):indices.update(range(max(0,i-2),min(len(lines),i+4)))
    print('SOURCE',path,hashlib.sha256(raw).hexdigest())
    for i in sorted(indices):
     line=lines[i]
     if re.search(r"(?:secret|password|token)\s*['\"]?\s*=>\s*['\"][^$]",line,re.I):line='[redacted literal credential]'
     print(str(i+1)+': '+line)
 finally:t.close()
if __name__=='__main__':main()
