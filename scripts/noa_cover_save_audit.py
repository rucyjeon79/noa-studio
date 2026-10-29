"""Read only deployed cover editor source; no content or database writes."""
import hashlib,json,paramiko
from pathlib import Path
from noa_full_inventory import connect,ROOT
def main():
 t=connect()
 try:
  with paramiko.SFTPClient.from_transport(t) as s:
   for target,local in [('noa-bridge/package-record.php','bridge/package-record.php'),('noa-bridge/inline-edit.php','bridge/inline-edit.php'),('noa-inline-edit.php','deploy/noa-inline-edit.php'),('noa-bridge/creator-core.php','bridge/creator-core.php')]:
    with s.open(ROOT+'/'+target,'rb') as f:live=f.read()
    expected=Path(local).read_bytes()
    print('COVER_EDITOR_SOURCE',json.dumps({'path':target,'match':live==expected,'liveSha':hashlib.sha256(live).hexdigest()}))
    if live!=expected:
     import difflib
     print('COVER_EDITOR_DIFF', ''.join(difflib.unified_diff(expected.decode().splitlines(True),live.decode().splitlines(True),n=1)))
 finally:t.close()
if __name__=='__main__':main()
