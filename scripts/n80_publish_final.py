"""Transfer only a finished local artifact to its immutable private destination; no host chunks."""
import hashlib,json,os,re,stat,sys,tempfile
from pathlib import Path
import paramiko
from noa_full_inventory import connect

def publish(request):
    job=request['id'];filename=request['file'];source=Path(request['path'])
    if not re.fullmatch(r'[a-f0-9]{32}',job) or not re.fullmatch(r'(optimized|landscape|shorts)-[a-f0-9]{64}\.(audio|mp4)',filename):raise ValueError('invalid_final_identity')
    if source.is_symlink() or not source.is_file() or not source.resolve().is_relative_to(Path(tempfile.gettempdir()).resolve()):raise ValueError('invalid_local_final')
    with source.open('rb') as local:
        digest=hashlib.file_digest(local,'sha256').hexdigest()
    if digest!=request['sha256'] or digest not in filename:raise ValueError('local_final_checksum_mismatch')
    transport=connect();created=False
    try:
        with paramiko.SFTPClient.from_transport(transport) as sftp:
            sftp.get_channel().settimeout(60)
            directory='/hosting/noastudio/noa-ai-lab/jobs/'+job
            for component in ['/hosting/noastudio/noa-ai-lab','/hosting/noastudio/noa-ai-lab/jobs',directory]:
                if not stat.S_ISDIR(sftp.lstat(component).st_mode):raise ValueError('unsafe_final_directory')
            destination=directory+'/'+filename
            try:existing=sftp.lstat(destination)
            except FileNotFoundError:existing=None
            if existing:
                if not stat.S_ISREG(existing.st_mode) or existing.st_size!=source.stat().st_size:raise ValueError('existing_final_conflict')
            else:
                try:
                    with sftp.open(destination,'wx') as output,source.open('rb') as local:
                        created=True;sftp.chmod(destination,0o600)
                        while chunk:=local.read(1048576):output.write(chunk)
                    if sftp.stat(destination).st_size!=source.stat().st_size:raise ValueError('final_size_mismatch')
                except BaseException:
                    if created:sftp.remove(destination)
                    raise
            with sftp.open(destination,'rb') as remote:
                actual=hashlib.file_digest(remote,'sha256').hexdigest()
            if actual!=digest:
                if created:sftp.remove(destination)
                raise ValueError('final_readback_mismatch')
    finally:transport.close()
    return {'ok':True,'sha256':digest,'bytes':source.stat().st_size,'hostTemporaryFiles':0}
if __name__=='__main__':
    try:print(json.dumps(publish(json.load(sys.stdin))))
    except Exception as error:print(json.dumps({'ok':False,'error':str(error) if re.fullmatch(r'[a-z_]+',str(error)) else 'final_transfer_failed'}));sys.exit(1)
