"""Read only selected public bootstrap code; never read DB configuration or user data."""
import json, os, socket, stat
from pathlib import Path
import paramiko
from busan_readonly_check import configuration, fingerprint, HOST, USER, PORT, ROOT
import hmac, hashlib

def main():
    host,user,password,trusted=configuration(os.environ)
    report={'host':host,'root':ROOT,'remote_files_modified':0,'sql_accessed':False}
    with socket.create_connection((HOST,PORT),timeout=15) as sock:
        with paramiko.Transport(sock) as t:
            t.banner_timeout=15
            t.auth_timeout=15
            t.get_security_options().key_types=('ssh-ed25519',)
            t.start_client(timeout=20)
            if not hmac.compare_digest(fingerprint(t.get_remote_server_key()),trusted):
                raise RuntimeError('host_key_mismatch')
            t.auth_password(USER,password,fallback=False)
            with paramiko.SFTPClient.from_transport(t) as sftp:
                sftp.get_channel().settimeout(20)
                if sftp.normalize(ROOT)!=ROOT: raise RuntimeError('unexpected_root')
                report['directories']={}
                for name in ['theme','extend','Custom','_uxcamp']:
                    path=ROOT+'/'+name
                    if sftp.normalize(path)!=path or not stat.S_ISDIR(sftp.lstat(path).st_mode):
                        raise RuntimeError('unexpected_directory')
                    report['directories'][name]=sorted(e.filename for e in sftp.listdir_attr(path) if not e.filename.startswith('.'))
                report['bootstrap_files']={}
                for name in ['index.php','common.php','head.php','tail.php','version.php']:
                    path=ROOT+'/'+name
                    attrs=sftp.lstat(path)
                    if sftp.normalize(path)!=path or not stat.S_ISREG(attrs.st_mode) or attrs.st_size>524288:
                        raise RuntimeError('unexpected_file')
                    with sftp.open(path,'rb') as f: raw=f.read(524289)
                    if len(raw)>524288: raise RuntimeError('file_limit')
                    code=raw.decode('utf-8',errors='replace')
                    tokens=['G5_THEME_PATH','common.php','_uxcamp','Custom','run_event','mb_level','mb_intercept_date','mb_leave_date','extend']
                    report['bootstrap_files'][name]={'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'markers':{v:v in code for v in tokens}}
                try:
                    sftp.lstat(ROOT+'/busan-assistant')
                    report['candidate_path_exists']=True
                except FileNotFoundError:
                    report['candidate_path_exists']=False
    report['status']='passed'
    Path('busan-check-result').mkdir(exist_ok=True)
    Path('busan-check-result/structure.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False))

if __name__=='__main__': main()
