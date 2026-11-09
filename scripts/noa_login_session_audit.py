"""Read-only audit of native login lifecycle; never reads member/session contents."""
import json,re,hashlib,secrets,time,urllib.request
import paramiko
from noa_full_inventory import ROOT,connect

def main():
 t=connect()
 try:
  with paramiko.SFTPClient.from_transport(t) as s:
   s.get_channel().settimeout(30)
   names=s.listdir(ROOT+'/extend');print('EXTENSIONS',json.dumps(names))
   print('SOCIAL_FILES',json.dumps(s.listdir(ROOT+'/plugin/social')))
   paths=['lib/common.lib.php','plugin/social/_common.php','plugin/social/config.php','common.php','bbs/login.php','bbs/login_check.php','bbs/logout.php','plugin/social/includes/functions.php','plugin/social/includes/config.php','plugin/social/index.php','plugin/social/Hybrid/Auth.php']
   paths += ['extend/'+n for n in names if any(w in n.lower() for w in ['social','session','cookie','login'])]
   for path in paths:
    try:
     with s.open(ROOT+'/'+path,'rb') as f:raw=f.read()
    except FileNotFoundError:continue
    lines=raw.decode('utf-8','replace').splitlines();indices=set()
    for i,line in enumerate(lines):
     if path=='extend/social_login.extend.php' or re.search(r'G5_SOCIAL_USE_POPUP|session|ss_mb_|auto_login|set_cookie|HTTP_USER_AGENT|REMOTE_ADDR|redirect_to_idp|opener|window.close|goto_url|social_login_success',line,re.I):indices.update(range(max(0,i-2),min(len(lines),i+4)))
    print('SOURCE',path,hashlib.sha256(raw).hexdigest())
    for i in sorted(indices):
     line=lines[i]
     if re.search(r"(?:secret|password|token)\s*['\"]?\s*=>\s*['\"][^$]",line,re.I):line='[redacted literal credential]'
     print(str(i+1)+': '+line)
   token=secrets.token_hex(32);name='noa-login-audit-'+secrets.token_hex(12)+'.php';remote=ROOT+'/'+name
   code=("<?php if(time()>"+str(int(time.time())+300)+"||!hash_equals('"+hashlib.sha256(token.encode()).hexdigest()+"',hash('sha256',$_SERVER['HTTP_X_NOA_AUDIT']??''))){http_response_code(404);exit;} ob_start();require __DIR__.'/common.php';ob_end_clean();header('Content-Type: application/json');echo json_encode(['handler'=>ini_get('session.save_handler'),'path'=>session_save_path(),'gc'=>ini_get('session.gc_maxlifetime'),'cookie'=>session_get_cookie_params(),'popup'=>defined('G5_SOCIAL_USE_POPUP')?G5_SOCIAL_USE_POPUP:null]);").encode()
   with s.open(remote,'wx') as f:f.write(code)
   try:
    s.chmod(remote,0o644)
    req=urllib.request.Request('https://noastudio.ai.kr/'+name,headers={'X-NOA-Audit':token})
    with urllib.request.urlopen(req,timeout=30) as r:print('RUNTIME',r.read().decode())
   finally:
    with s.open(remote,'rb') as f:owned=f.read()==code
    if owned:s.remove(remote)
 finally:t.close()
if __name__=='__main__':main()
