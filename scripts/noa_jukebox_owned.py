"""Read only explicitly designated, owned download files from a private registry.
No public playback URL, encryption key, browser session or credential is used.
"""
import hashlib,json,shutil,stat
from pathlib import Path
ROOT='/hosting/noastudio/noa-jukebox-owned'
MAX_FILE=160*1024*1024
MAX_BATCH=512*1024*1024

def stage(sftp,rows,work):
 folder=Path(work)/'owned-input';folder.mkdir(parents=True,exist_ok=True)
 try:
  with sftp.open(ROOT+'/sources.json','rb') as f:
   raw=f.read(2*1024*1024+1)
 except FileNotFoundError:return {},folder
 if len(raw)>2*1024*1024:raise ValueError('owned_registry_too_large')
 registry=json.loads(raw);out={};used=0
 if not isinstance(registry,dict):raise ValueError('owned_registry_invalid')
 if sftp.normalize(ROOT)!=ROOT:raise ValueError('owned_directory_symlink')
 for row in rows:
  entry=registry.get(row['key']);target=None
  if not isinstance(entry,dict) or entry.get('authorization')!='user_owned_download':continue
  try:
   name=entry.get('file','')
   if not isinstance(name,str) or Path(name).name!=name or not name or '\\' in name or '\x00' in name:raise ValueError('owned_source_filename_invalid')
   if Path(name).suffix.lower() not in ['.mp3','.m4a','.aac','.flac','.ogg','.opus','.mp4','.wav']:raise ValueError('owned_source_format_invalid')
   remote=ROOT+'/'+name;info=sftp.lstat(remote)
   if not stat.S_ISREG(info.st_mode) or info.st_size>MAX_FILE or used+info.st_size>MAX_BATCH:raise ValueError('owned_source_size_or_type_limit')
   if shutil.disk_usage(folder).free<MAX_BATCH*2:raise ValueError('owned_temporary_space_insufficient')
   target=folder/(hashlib.sha256(row['key'].encode()).hexdigest()+Path(name).suffix.lower())
   h=hashlib.sha256();size=0
   with sftp.open(remote,'rb') as source,target.open('xb') as dest:
    while True:
     chunk=source.read(1024*1024)
     if not chunk:break
     size+=len(chunk)
     if size>MAX_FILE:raise ValueError('owned_file_size_changed')
     h.update(chunk);dest.write(chunk)
   if size!=info.st_size or (entry.get('sha256') and entry['sha256']!=h.hexdigest()):raise ValueError('owned_source_hash_mismatch')
   used+=size;out[row['key']]={'path':str(target.resolve()),'authorization':'user_owned_download','suno_id':entry.get('suno_id','')}
  except (OSError,ValueError):
   if target:target.unlink(missing_ok=True)
   out[row['key']]={'error':'owned_source_missing_invalid_or_over_limit'}
 return out,folder

def cleanup(folder):
 shutil.rmtree(folder,ignore_errors=False)
