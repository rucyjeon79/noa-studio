"""Read only the access rules and file permissions involved in native music."""
import sys,stat,json,hashlib
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import paramiko
from noa_full_inventory import connect,ROOT
t=connect();s=paramiko.SFTPClient.from_transport(t);s.get_channel().settimeout(30)
try:
 for relative in ['.htaccess','noa-app/.htaccess','noa-app/jukebox/.htaccess','noa-app/jukebox/stream.php','noa-bridge/member-access.php','noa-bridge/catalog.php','noa-app','noa-app/jukebox']:
  path=ROOT+'/'+relative
  try:st=s.lstat(path)
  except FileNotFoundError:
   print(json.dumps({'path':relative,'missing':True}));continue
  row={'path':relative,'mode':oct(stat.S_IMODE(st.st_mode)),'directory':stat.S_ISDIR(st.st_mode)}
  if stat.S_ISREG(st.st_mode):
   with s.open(path,'rb') as f:raw=f.read()
   row['sha256']=hashlib.sha256(raw).hexdigest()
   if relative.endswith('.htaccess'):
    row['accessRules']=[l for l in raw.decode(errors='replace').splitlines() if any(x.lower() in l.lower() for x in ['Require','Deny','Allow','Files','Directory','Rewrite','ErrorDocument','SetHandler'])]
  print(json.dumps(row))
finally:s.close();t.close()
