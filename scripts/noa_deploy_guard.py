"""Fail-closed deployment preflight. Does not touch jobs, media or application code."""
import errno,hashlib,json,stat
from contextlib import contextmanager

class DeployBlocked(RuntimeError):
 def __init__(self,code,path,detail=''):
  self.code=code;self.path=path
  super().__init__(json.dumps({'code':code,'path':path,'detail':detail}))

def checked_directory(s,path):
 try:info=s.lstat(path)
 except FileNotFoundError:raise DeployBlocked('BACKUP_PARENT_MISSING',path)from None
 if not stat.S_ISDIR(info.st_mode)or s.normalize(path)!=path:raise DeployBlocked('UNSAFE_BACKUP_PATH',path)
 return info

def create_directory(s,path,mode=0o700):
 try:s.mkdir(path,mode)
 except OSError as error:
  try:checked_directory(s,path)
  except DeployBlocked:
   code={errno.ENOSPC:'STORAGE_FULL',errno.EDQUOT:'STORAGE_QUOTA',errno.EACCES:'WRITE_DENIED',errno.EPERM:'WRITE_DENIED'}.get(error.errno,'BACKUP_MKDIR_FAILED')
   raise DeployBlocked(code,path,str(error))from None
  else:raise DeployBlocked('BACKUP_PATH_ALREADY_EXISTS',path)from None
 checked_directory(s,path)

def verified_backup(s,path,data):
 try:
  with s.open(path,'wx')as f:f.write(data)
  s.chmod(path,0o600)
  with s.open(path,'rb')as f:actual=f.read()
 except OSError as error:raise DeployBlocked('BACKUP_WRITE_FAILED',path,str(error))from None
 if hashlib.sha256(actual).digest()!=hashlib.sha256(data).digest():raise DeployBlocked('BACKUP_HASH_MISMATCH',path)

@contextmanager
def deployment_preflight(s,parent,run,required_bytes,available_bytes):
 checked_directory(s,parent)
 if available_bytes is not None and available_bytes<required_bytes+16*1024*1024:raise DeployBlocked('STORAGE_INSUFFICIENT',parent)
 lock=parent+'/.work-deploy-lock'
 try:s.mkdir(lock,0o700)
 except OSError as e:
  try:s.lstat(lock)
  except FileNotFoundError:raise DeployBlocked('BACKUP_LOCK_CREATE_FAILED',lock,str(e))from None
  raise DeployBlocked('DEPLOYMENT_BUSY',lock)from None
 probe=lock+'/write-check'
 try:
  verified_backup(s,probe,('NOA deployment preflight '+str(run)).encode())
  s.remove(probe)
  backup=parent+'/p0-'+str(run);create_directory(s,backup)
  yield backup
 finally:
  # Remove only this invocation's lock. Never delete existing backups on failure.
  try:s.remove(probe)
  except FileNotFoundError:pass
  s.rmdir(lock)
