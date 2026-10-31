"""Read installed database adapter source; no data or application mutation."""
import paramiko
from noa_full_inventory import connect,ROOT
t=connect()
try:
 with paramiko.SFTPClient.from_transport(t) as s:
  with s.open(ROOT+'/lib/common.lib.php','rb') as f:src=f.read().decode('utf-8',errors='replace')
  start=src.index('function sql_query(');end=src.find('\nfunction ',start+10)
  print(src[start:end])
finally:t.close()
