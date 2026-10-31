"""Read-only native signup event contract; no member records or credentials exported."""
import paramiko
from noa_full_inventory import connect, ROOT
t=connect()
try:
 with paramiko.SFTPClient.from_transport(t) as s:
  for path in ['plugin/social/register_member_update.php','bbs/register_form_update.php']:
   with s.open(ROOT+'/'+path,'rb') as f: code=f.read().decode()
   lines=code.splitlines()
   print('CONTRACT',path)
   for i,line in enumerate(lines):
    if any(v in line for v in ['run_event(', 'insert_point(', 'set_session(', 'sql_query($sql', 'mb_datetime', 'mb_recommend']):
     print('\n'.join(f'{j+1}: {lines[j]}' for j in range(max(0,i-2),min(len(lines),i+3))))
finally:t.close()
