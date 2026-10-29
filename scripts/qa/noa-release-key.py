"""Create once and verify a private release identity; never replace an existing vault."""
import base64,hashlib,json,os,secrets,stat,subprocess,tempfile
from pathlib import Path
import paramiko
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from noa_full_inventory import connect
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
VAULT='/hosting/noastudio/noa-android-signing-v1'

def digest(data):return hashlib.sha256(data).hexdigest()
def main():
    t=connect();s=paramiko.SFTPClient.from_transport(t);s.get_channel().settimeout(45)
    try:
        try:
            info=s.lstat(VAULT)
            if not stat.S_ISDIR(info.st_mode) or stat.S_IMODE(info.st_mode)!=0o700:raise RuntimeError('Existing signing vault has unexpected permissions')
        except FileNotFoundError:
            s.mkdir(VAULT,0o700)
        try:
            with s.open(VAULT+'/identity.json','rb') as f:identity=json.load(f)
            for name in ('release.p12','password'):
                info=s.lstat(VAULT+'/'+name)
                if not stat.S_ISREG(info.st_mode) or stat.S_IMODE(info.st_mode)!=0o600:raise RuntimeError('Private signing file permission mismatch')
            with s.open(VAULT+'/release.p12','rb') as f:key=f.read()
            with s.open(VAULT+'/password','rb') as f:password=f.read().decode()
            if digest(key)!=identity['keystoreSha256']:raise RuntimeError('Existing signing key integrity mismatch')
        except FileNotFoundError:
            if s.listdir(VAULT):raise RuntimeError('Incomplete vault preserved for recovery; refusing replacement')
            password=secrets.token_urlsafe(48)
            with tempfile.TemporaryDirectory() as directory:
                path=Path(directory)/'release.p12'
                env={**os.environ,'NOA_RELEASE_PASSWORD':password}
                subprocess.run(['keytool','-genkeypair','-keystore',str(path),'-storetype','PKCS12','-storepass:env','NOA_RELEASE_PASSWORD','-keypass:env','NOA_RELEASE_PASSWORD','-alias','noa-release','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=NOA STUDIO, O=NOA STUDIO, C=KR'],env=env,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
                key=path.read_bytes()
            identity={'schemaVersion':1,'alias':'noa-release','keystoreSha256':digest(key),'createdByRun':os.environ['GITHUB_RUN_ID']}
            for name,data in [('release.p12',key),('password',password.encode())]:
                with s.open(VAULT+'/'+name,'wx') as f:f.write(data)
                s.chmod(VAULT+'/'+name,0o600)
                with s.open(VAULT+'/'+name,'rb') as f:
                    if digest(f.read())!=digest(data):raise RuntimeError('Private vault readback mismatch')
        # Verify the actual private key and derive only its public certificate fingerprint.
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'release.p12';path.touch(mode=0o600);path.write_bytes(key)
            cert=subprocess.check_output(['keytool','-exportcert','-keystore',str(path),'-storepass:env','NOA_RELEASE_PASSWORD','-alias',identity['alias']],env={**os.environ,'NOA_RELEASE_PASSWORD':password},stderr=subprocess.DEVNULL)
            fingerprint=digest(cert)
            if identity.get('certificateSha256',fingerprint)!=fingerprint:raise RuntimeError('Certificate changed')
            identity['certificateSha256']=fingerprint
        try:
            with s.open(VAULT+'/identity.json','wx') as f:f.write(json.dumps(identity).encode())
            s.chmod(VAULT+'/identity.json',0o600)
        except OSError:
            with s.open(VAULT+'/identity.json','rb') as f:
                if json.load(f)!=identity:raise RuntimeError('Identity record differs')
        # Off-host recovery artifact: authenticated encryption, protected by the existing SSH secret.
        salt=secrets.token_bytes(16);nonce=secrets.token_bytes(12)
        wrapping=Scrypt(salt=salt,length=32,n=2**17,r=8,p=1).derive(os.environ['NOA_SSH_PASSWORD'].encode())
        payload=json.dumps({'identity':identity,'keystore':base64.b64encode(key).decode(),'password':password}).encode()
        encrypted=AESGCM(wrapping).encrypt(nonce,payload,b'NOA-ANDROID-SIGNING-BACKUP-V1')
        output=Path('signing-proof');output.mkdir(exist_ok=True)
        (output/'release-key-backup.enc').write_bytes(b'NOA-ANDROID-KEY-V1\n'+salt+nonce+encrypted)
        (output/'identity.json').write_text(json.dumps(identity,indent=2))
        print('RELEASE_KEY_VERIFIED '+json.dumps(identity))
    finally:s.close();t.close()
if __name__=='__main__':main()
