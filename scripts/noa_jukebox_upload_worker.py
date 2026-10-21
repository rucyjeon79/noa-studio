"""Process only administrator-uploaded MP3/WAV. No provider audio requests."""
import hashlib,json,os,secrets,stat,tempfile,time,threading
from pathlib import Path
import noa_jukebox_worker as media
PRIVATE='/hosting/noastudio/noa-jukebox-private'

def process_uploads(sftp,call,mkdir,source_reader=None,worker_identity=None):
    if worker_identity is None:return _drain_uploads(sftp,call,mkdir,source_reader)
    identity=worker_identity|{'owner':secrets.token_hex(16)}
    acquired=call('worker_start',identity)
    if not acquired.get('acquired'):return []
    owner=acquired['owner'];stop=threading.Event()
    def pulse():
        while not stop.wait(30):
            try:call('worker_heartbeat',{'owner':owner})
            except Exception:pass # job lease/verified run observation still fence publication
    thread=threading.Thread(target=pulse,daemon=True);thread.start()
    def owned_call(action,payload=None):
        if action.startswith('upload_'):payload=(payload or {})|{'worker_owner':owner}
        if action=='upload_heartbeat':call('worker_heartbeat',{'owner':owner})
        return call(action,payload)
    try:return _drain_uploads(sftp,owned_call,mkdir,source_reader,int(worker_identity.get('keepalive_seconds',0)))
    finally:
        stop.set();thread.join(timeout=2)
        try:call('worker_finish',{'owner':owner})
        except Exception:pass

def _drain_uploads(sftp,call,mkdir,source_reader=None,idle_seconds=0):
    started=time.monotonic();results=[];deadline=started+50*60;idle_until=min(deadline,started+max(0,idle_seconds));processed=0;last_maintenance=started
    while processed<100:
        if time.monotonic()>deadline:break
        claimed=call('upload_claim')['uploads']
        if not claimed:
            if time.monotonic()>=idle_until:break
            if time.monotonic()-last_maintenance>=60:
                try:call('maintenance')
                except Exception:pass
                last_maintenance=time.monotonic()
            time.sleep(min(15,max(0,idle_until-time.monotonic())));continue
        processed+=1
        if len(claimed)!=1:raise ValueError('queue_concurrency_contract')
        job=claimed[0];auth={'id':job['id'],'lease':job['lease'],'job_id':job['job_id']}
        stop=threading.Event();lost=threading.Event()
        def pulse(auth=auth,stop=stop,lost=lost):
            while not stop.wait(30):
                try:call('upload_heartbeat',auth)
                except Exception:
                    # One failed response must not invalidate a healthy FFmpeg.
                    # The synchronous ownership check retries before publication.
                    continue
        heartbeat=threading.Thread(target=pulse,daemon=True);heartbeat.start()
        def owned():
            if lost.is_set():raise ValueError('upload_lease_changed')
            call('upload_heartbeat',auth)
        try:
            with tempfile.TemporaryDirectory(prefix='noa-upload-') as temp:
                source=Path(temp)/('input.'+job['extension']);output=Path(temp)/'final.mp3'
                remote=PRIVATE+'/incoming/'+job['id']+'/input.audio'
                info=sftp.lstat(remote)
                if not stat.S_ISREG(info.st_mode) or info.st_size!=job['bytes'] or info.st_size>256*1024*1024:raise ValueError('uploaded_input_size_or_type_changed')
                if sftp.normalize(PRIVATE+'/incoming/'+job['id'])!=PRIVATE+'/incoming/'+job['id']:raise ValueError('unsafe_input_directory')
                transfer_started=time.monotonic();transport='sftp'
                if source_reader and source_reader(job,source):transport='ssh_stream'
                else:
                    with sftp.open(remote,'rb') as src,source.open('xb') as dst:
                        # Bound parallel reads to avoid one network round trip per 32 KiB.
                        src.prefetch(file_size=job['bytes'],max_concurrent_requests=16)
                        size=0
                        while True:
                            block=src.read(1024*1024)
                            if not block:break
                            size+=len(block)
                            if size>job['bytes']:raise ValueError('uploaded_input_grew')
                            dst.write(block)
                transfer_seconds=round(time.monotonic()-transfer_started,2)
                if media.digest(source)!=job['sha256']:raise ValueError('uploaded_input_hash_changed')
                def measured(before):
                    if before['duration']<.5 or before['duration']>1800 or before['channels']>8:raise ValueError('audio_duration_or_channel_limit')
                    if job['extension']=='mp3' and before['codec']!='mp3':raise ValueError('actual_codec_mismatch')
                    if job['extension']=='wav' and not before['codec'].startswith('pcm_'):raise ValueError('actual_codec_mismatch')
                    call('upload_state',auth|{'status':'processing','source_analysis':before})
                before,settings,after=media.optimize(source,output,measured,lambda:call('upload_state',auth|{'status':'verifying'}))
                owned()
                context=dict(job['context']);row={'title':context['title'],'genre':context['genre'],'ep':context.get('ep',''),'originalArtist':context.get('originalArtist','')}
                card=None;card_errors=[]
                if not job.get('cover_path') and job['source_url']:
                    try:
                        metadata=media.metadata(job['source_url'])
                        if context.get('suno_id') and context['suno_id']!=metadata['suno_id']:raise ValueError('source_identity_changed')
                        context.update(suno_id=metadata['suno_id'],suno_title=metadata['suno_title'])
                        card=media.cover(Path(temp)/'cover.webp',metadata['image_url'])
                    except Exception:card_errors.append('cover:public_card_unavailable')
                if job.get('cover_path') and not job.get('previous_sha256'):
                    directory=Path(job['cover_path']).parent
                else:
                    directory=media.folder(row)
                    if job.get('previous_sha256'):directory=directory.with_name(directory.name+' [v-'+job['id'][:12]+']')
                title=context.get('suno_title') or context['title'];relative=directory/(media.component(title)+'.mp3')
                # Directory identity is immutable for the publication. Never overwrite
                # unknown bytes or an existing edition, including a stale worker's file.
                for part in relative.parts:
                    if part in ('','..','.') or '/' in part or '\\' in part:raise ValueError('invalid_output_path')
                parent=PRIVATE;mkdir(parent,0o700);parent+='/media';mkdir(parent,0o700)
                for part in relative.parts[:-1]:parent+='/'+part;mkdir(parent,0o700)
                target=PRIVATE+'/media/'+relative.as_posix();digest=media.digest(output)
                try:
                    existing=sftp.lstat(target)
                except FileNotFoundError:existing=None
                if existing:
                    if not stat.S_ISREG(existing.st_mode):raise ValueError('unsafe_output_file')
                    with sftp.open(target,'rb') as f:existing_hash=hashlib.sha256(f.read()).hexdigest()
                    if existing_hash!=digest:raise ValueError('existing_media_preserved')
                else:
                    stage=target+'.stage-'+job['id']
                    with sftp.open(stage,'wb') as f:f.set_pipelined(True);f.write(output.read_bytes())
                    sftp.chmod(stage,0o600);sftp.rename(stage,target)
                if card:
                    target_cover=PRIVATE+'/media/'+(directory/'cover.webp').as_posix()
                    try:existing=sftp.lstat(target_cover)
                    except FileNotFoundError:existing=None
                    if existing:
                        with sftp.open(target_cover,'rb') as f:cover_hash=hashlib.sha256(f.read()).hexdigest()
                        if not stat.S_ISREG(existing.st_mode) or cover_hash!=card['cover_sha256']:raise ValueError('existing_cover_preserved')
                    else:
                        with sftp.open(target_cover+'.stage-'+job['id'],'wb') as f:f.write((Path(temp)/'cover.webp').read_bytes())
                        sftp.chmod(target_cover+'.stage-'+job['id'],0o600);sftp.rename(target_cover+'.stage-'+job['id'],target_cover)
                result={'song_key':job['key'],'source_url':job['source_url'],'suno_id':context.get('suno_id',''),'suno_title':title,
                        'audio_path':relative.as_posix(),'audio_bytes':output.stat().st_size,'audio_sha256':digest,
                        'source_analysis':before,'correction':settings,'final_analysis':after,'errors':card_errors,
                        'audio_discovery':{'permission':'administrator_owned_upload','download_authorized':True,'provenance':'administrator_upload','upload_id':job['id']},
                        'catalog_context':{k:context.get(k) for k in ['originalArtist','act','catalogId','category1','category2','categoryIds']}}
                if card:result.update(cover_path=(directory/'cover.webp').as_posix(),cover_bytes=card['cover_bytes'],cover_sha256=card['cover_sha256'])
                owned();committed=call('upload_commit',auth|{'result':result})
                try:removed=call('upload_cleanup',{'id':job['id']})['input_removed']
                except Exception:removed=False # audit retries cleanup after confirmed SQL publication
                results.append({'job_id':job['job_id'],'key':job['key'],'ready':committed['ready'],'sha256':digest,'input_removed':removed,'source_transport':transport,'source_transfer_seconds':transfer_seconds})
        except Exception as error:
            # A committed MP3 must never be failed just because its acknowledgement
            # was lost. Query durable upload identity before recording a failure.
            try:
                restored=call('upload_reconcile',{'id':job['id']})
                if restored.get('status')=='ready' and restored.get('final_verified') and restored.get('source_matches_final'):
                    try:call('upload_cleanup',{'id':job['id']})
                    except Exception:pass
                    results.append({'job_id':job['job_id'],'key':job['key'],'ready':True,'response_recovered':True});continue
            except Exception:pass
            code=str(error).split(':',1)[0] if isinstance(error,ValueError) else 'upload_processing_failed'
            try:call('upload_fail',auth|{'error':code[:190]})
            except Exception:code='processing_state_changed_or_network_error'
            results.append({'job_id':job['job_id'],'key':job['key'],'ready':False,'error':code[:190]})
        finally:stop.set();heartbeat.join(timeout=2)
    return results
