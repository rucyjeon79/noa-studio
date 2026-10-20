"""Read-only production routes and signed private-storage capability verification."""
import urllib.request,urllib.error,json,os,base64,hashlib,hmac,time,secrets
import paramiko
BASE='https://noastudio.ai.kr'
def get(path):
 try:r=urllib.request.urlopen(BASE+path,timeout=40)
 except urllib.error.HTTPError as e:r=e
 return r.status,r.read()
def main():
 for path,expected in [('/',200),('/noa-music.php',200),('/noa-ai-lab.php',403),('/noa-bridge/lab-api.php',403),('/noa-bridge/lab-creator.php',403),('/noa-bridge/lab-file.php',403),('/noa-bridge/lab-oauth.php',403),('/noa-bridge/lab-worker.php',401),('/noa-ai-lab/master.key',404)]:
  status,_=get(path);assert status==expected,(path,status);print(path,status)
 status,raw=get('/noa-bridge/catalog.php');assert status==200;catalog=json.loads(raw);assert len(catalog['items'])==287,'Public library count changed';print('Public music documents preserved:',len(catalog['items']))
 t=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022));t.get_security_options().key_types=('ssh-ed25519',)
 try:
  t.start_client(timeout=20);fp='SHA256:'+base64.b64encode(hashlib.sha256(t.get_remote_server_key().asbytes()).digest()).decode().rstrip('=');assert fp==os.environ['NOA_SSH_HOST_FINGERPRINT'];t.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD']);s=paramiko.SFTPClient.from_transport(t)
  with s.open('/hosting/noastudio/noa-ai-lab/worker.key','rb') as f:key=f.read(256).decode().strip()
 finally:t.close()
 query='action=health';ts=str(int(time.time()));nonce=secrets.token_hex(16);signed='\n'.join(['GET',query,hashlib.sha256(b'').hexdigest(),ts,nonce]);signature=hmac.new(key.encode(),signed.encode(),hashlib.sha256).hexdigest();req=urllib.request.Request(BASE+'/noa-bridge/lab-worker.php?'+query,headers={'X-NOA-Timestamp':ts,'X-NOA-Nonce':nonce,'X-NOA-Signature':signature})
 with urllib.request.urlopen(req,timeout=40) as r:health=json.load(r)
 assert health['ok'] and health['privateStorage'] and health['curl'] and health['encryption'];print('Authenticated production worker health:',health)
 # A replay must fail, even with the original valid signature.
 try:urllib.request.urlopen(req,timeout=40);raise AssertionError('Replay accepted')
 except urllib.error.HTTPError as e:assert e.code==409
 print('Signed request replay rejected. No music or member data written.')
if __name__=='__main__':main()
