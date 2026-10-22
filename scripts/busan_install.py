"""Install only the newly authorized Busan module; never overwrite existing site files."""
import hashlib,hmac,json,os,secrets,socket,stat
from pathlib import Path
import paramiko
from busan_readonly_check import configuration,fingerprint,HOST,USER,PORT,ROOT
PARENT='/hosting/rucyjeon79'
PRIVATE=PARENT+'/busan-assistant-private'
TARGET=ROOT+'/busan-assistant'
FILES=('admin.php','api.php','app.js','bootstrap.php','index.php','policy.php','style.css')
CONFIG=b"<?php\nreturn ['enabled'=>true,'ai_enabled'=>false,'api_key'=>'','model'=>'','allowed_boards'=>['notice','LU_notice','note','LU_data'],'ai_boards'=>[],'state_dir'=>'/hosting/rucyjeon79/busan-assistant-private/state'];\n"

def digest(data):return hashlib.sha256(data).hexdigest()
def missing(sftp,path):
    try:sftp.lstat(path);return False
    except FileNotFoundError:return True

def regular(sftp,path):
    a=sftp.lstat(path)
    if not stat.S_ISREG(a.st_mode) or sftp.normalize(path)!=path:raise RuntimeError('unexpected_file')
    return a

def same(sftp,path,data):
    a=regular(sftp,path)
    if a.st_size!=len(data):return False
    with sftp.open(path,'rb') as f:raw=f.read(len(data)+1)
    return hmac.compare_digest(digest(raw),digest(data))

def directory(sftp,path):
    if not stat.S_ISDIR(sftp.lstat(path).st_mode) or sftp.normalize(path)!=path:raise RuntimeError('unexpected_directory')

def create(sftp,path,data,mode):
    if not missing(sftp,path):raise RuntimeError('existing_file_refused')
    with sftp.open(path,'wx') as f:f.write(data)
    sftp.chmod(path,mode)
    if not same(sftp,path,data):raise RuntimeError('uploaded_hash_mismatch')

def main():
    host,user,password,trusted=configuration(os.environ)
    package=Path(os.environ['BUSAN_PACKAGE_DIR'])
    payload={f:(package/'busan-assistant'/f).read_bytes() for f in FILES}
    hashes=json.loads((package/'install-hashes.json').read_text())
    if {f:digest(data) for f,data in payload.items()}!=hashes:raise RuntimeError('local_candidate_hash_mismatch')
    report={'status':'pending','root':ROOT,'module':TARGET,'core_files_modified':0,'sql_changed':False,'ai_enabled':False,'files':[]}
    stage='connect'
    try:
        with socket.create_connection((host,PORT),timeout=15) as sock:
            with paramiko.Transport(sock) as t:
                t.banner_timeout=15;t.auth_timeout=15
                t.get_security_options().key_types=('ssh-ed25519',)
                t.start_client(timeout=20)
                if not hmac.compare_digest(fingerprint(t.get_remote_server_key()),trusted):raise RuntimeError('host_key_mismatch')
                t.auth_password(user,password,fallback=False)
                with paramiko.SFTPClient.from_transport(t) as s:
                    s.get_channel().settimeout(20)
                    stage='preflight'
                    for path in (PARENT,ROOT):directory(s,path)
                    if not missing(s,TARGET):
                        directory(s,TARGET)
                        if set(s.listdir(TARGET))!=set(FILES) or not all(same(s,TARGET+'/'+f,data) for f,data in payload.items()):
                            raise RuntimeError('existing_module_differs_refused')
                    if missing(s,PRIVATE):s.mkdir(PRIVATE,0o700)
                    directory(s,PRIVATE)
                    if stat.S_IMODE(s.lstat(PRIVATE).st_mode)!=0o700:raise RuntimeError('private_directory_mode_mismatch')
                    config=PRIVATE+'/config.php'
                    if not missing(s,config) and not same(s,config,CONFIG):raise RuntimeError('existing_config_differs_refused')
                    stage='install_new_module'
                    if missing(s,TARGET):
                        temporary=PRIVATE+'/release-'+secrets.token_hex(12)
                        s.mkdir(temporary,0o700)
                        directory(s,temporary)
                        for f,data in payload.items():create(s,temporary+'/'+f,data,0o644)
                        s.chmod(temporary,0o755)
                        if not missing(s,TARGET):raise RuntimeError('target_appeared_refused')
                        s.rename(temporary,TARGET)
                    stage='activate_search_only'
                    if missing(s,config):
                        temporary=PRIVATE+'/config-'+secrets.token_hex(12)+'.tmp'
                        create(s,temporary,CONFIG,0o600)
                        s.rename(temporary,config)
                    if stat.S_IMODE(s.lstat(config).st_mode)!=0o600:raise RuntimeError('config_mode_mismatch')
                    for f,data in payload.items():
                        if not same(s,TARGET+'/'+f,data):raise RuntimeError('final_module_hash_mismatch')
                        report['files'].append({'path':TARGET+'/'+f,'sha256':digest(data)})
                    if not same(s,config,CONFIG):raise RuntimeError('final_config_hash_mismatch')
                    report.update(status='installed',file_count=len(FILES),private_config_verified=True)
    except Exception as e:
        report.update(status='failed',failed_stage=stage,error=type(e).__name__)
        # Fixed internal errors contain no user or server-supplied text.
        if type(e) is RuntimeError:report['error']=str(e)
    out=Path('busan-install-result');out.mkdir(exist_ok=True)
    (out/'result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False))
    return 0 if report['status']=='installed' else 1
if __name__=='__main__':raise SystemExit(main())
