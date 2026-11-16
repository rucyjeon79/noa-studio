#!/usr/bin/env python3
"""Read-only SSH execution capability probe (no PHP code, state or writes)."""
import base64,hashlib,json,os,paramiko
PIN='SHA256:0LqxbpOziJ4XgOMNEkfVrVGle3kpjJessI+jKqZ4JCU'
transport=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022))
try:
 transport.get_security_options().key_types=('ssh-ed25519',)
 transport.start_client(timeout=15)
 key=transport.get_remote_server_key()
 fp='SHA256:'+base64.b64encode(hashlib.sha256(key.asbytes()).digest()).decode().rstrip('=')
 if fp!=PIN:raise RuntimeError('Pinned N80 SSH host identity mismatch')
 transport.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD'])
 report={'hostVerified':True,'sftpOnly':None,'commandExecution':False,'phpCli':False,'productionWrites':0}
 try:
  channel=transport.open_session(timeout=12)
  channel.settimeout(12)
  channel.exec_command('printf N80_READONLY_SHELL_OK')
  stdout=channel.makefile('r').read(100)
  report['commandExecution']=stdout=='N80_READONLY_SHELL_OK'
  channel.close()
  if report['commandExecution']:
   command=transport.open_session(timeout=12)
   command.settimeout(12)
   command.exec_command('command -v php >/dev/null 2>&1 && printf N80_PHP_CLI_OK || printf N80_PHP_CLI_MISSING')
   result=command.makefile('r').read(100)
   report['phpCli']=result=='N80_PHP_CLI_OK'
   command.close()
 except Exception as exc:
  report['diagnostic']='shell_execution_rejected_or_unavailable'
 report['sftpOnly']=not report['commandExecution']
 print('N80_HOST_EXEC_CAPABILITY '+json.dumps(report))
finally:
 transport.close()
