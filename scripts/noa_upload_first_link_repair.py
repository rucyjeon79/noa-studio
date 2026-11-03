"""Repair the verified empty-to-first-link upload race, with exact source CAS."""
import hashlib,json,os,secrets,stat,time,urllib.request
from pathlib import Path
import paramiko
from noa_full_inventory import connect,ROOT
from noa_jukebox_recovery import signed_service
from noa_jukebox_upload_worker import process_uploads
import noa_jukebox_worker as media
PHP = "<?php\ndeclare(strict_types=1);\nini_set('display_errors','0');\nif(!hash_equals('__TOKEN_HASH__',hash('sha256',$_SERVER['HTTP_X_NOA_DIAGNOSTIC']??''))){http_response_code(403);exit;}\nif(function_exists('opcache_invalidate'))opcache_invalidate(__DIR__.'/noa-app/jukebox/operations.php',true);\nrequire __DIR__.'/common.php';require __DIR__.'/noa-bridge/storage.php';require __DIR__.'/noa-bridge/sound-core.php';require __DIR__.'/noa-bridge/lab-core.php';require __DIR__.'/noa-app/jukebox/operations.php';\nif(session_status()===PHP_SESSION_ACTIVE)session_write_close();\nheader('Content-Type: application/json');\n$db=noa_bridge_pdo();$key='single:pop-original:32';\n$q=$db->prepare('SELECT * FROM noa_jukebox_uploads WHERE song_key=? ORDER BY sequence DESC LIMIT 1');$q->execute([$key]);$u=$q->fetch(PDO::FETCH_ASSOC);\n$a=nj_find($db,$key);$d=nj_document($db,$key);\nif(($_SERVER['HTTP_X_NOA_RECOVER']??'')==='1'&&$u['status']!=='ready'){\n if($u['id']!=='2f993b409d3465d86a05b5a46771cb28'||$u['status']!=='failed'||$u['error']!=='signed_upload_commit_http_409'||$u['source_url']!==''||$u['previous_sha256']!==null||!empty($a['audio_sha256'])||noa_sound_suno($d['body']??[])!=='https://suno.com/s/3T0G9aGwwrsnYXPz'||!nr_reconcile($db,$key,$u['id'])['source_verified'])throw new RuntimeException('recovery_preconditions_changed');\n nq_atomic($db,function()use($db,$u){\n  $current=nu_row($db,$u['id']);$job=nq_latest($db,$u['id']);\n  if($current['status']!=='failed'||$job['id']!==592||$job['attempt']!==1)throw new RuntimeException('recovery_job_changed');\n  if($db->query(\"SELECT COUNT(*) FROM noa_jukebox_audio_jobs WHERE status IN ('queued','retrying','analyzing','processing','verifying')\")->fetchColumn())throw new RuntimeException('other_work_pending');\n  nq_insert($db,$current,'retrying',2,592);\n });\n $u=nu_row($db,$u['id']);\n}\n\n$out=['key'=>$key,'upload'=>array_intersect_key($u,array_flip(['id','status','error','source_url','previous_sha256','sha256','file_bytes','source_analysis','correction','final_analysis'])),'asset'=>$a,'source_current'=>noa_sound_suno($d['body']??[]),'source_verified'=>nr_reconcile($db,$key,$u['id'])['source_verified'],'job'=>nq_latest($db,$u['id'])];\n$dir=dirname(nj_file($a['cover_path'])?:'');$out['output_files']=[];\nif($dir&&is_dir($dir)){foreach(glob($dir.'/*') as $p)if(is_file($p))$out['output_files'][]=['name'=>basename($p),'bytes'=>filesize($p),'sha256'=>hash_file('sha256',$p)];}\necho json_encode($out,JSON_THROW_ON_ERROR);\n"
BASELINE='b75d44cccd7e3bdb871661dd27142c5033560928aa9e273012fefc7499c30135'
def main():
    token=secrets.token_hex(32)
    code=PHP.replace('__TOKEN_HASH__',hashlib.sha256(token.encode()).hexdigest()).encode()
    name='noa-upload-repair-'+secrets.token_hex(12)+'.php'
    desired=Path('deploy/noa-app/jukebox/operations.php').read_bytes()
    out=Path('upload-repair-proof');out.mkdir(exist_ok=True)
    t=connect();t.set_keepalive(20)
    try:
        with paramiko.SFTPClient.from_transport(t,window_size=8388608) as s:
            s.get_channel().settimeout(90)
            remote=ROOT+'/noa-app/jukebox/operations.php'
            with s.open(remote,'rb') as f:before=f.read()
            if before!=desired:
                if hashlib.sha256(before).hexdigest()!=BASELINE:raise RuntimeError('concurrent_source_preserved')
                stage=remote+'.repair-'+os.environ['GITHUB_RUN_ID']
                try:
                    with s.open(stage,'wx') as f:f.write(desired)
                    s.chmod(stage,0o644)
                    with s.open(stage,'rb') as f:
                        if f.read()!=desired:raise RuntimeError('staged_hash_mismatch')
                    with s.open(remote,'rb') as f:
                        if f.read()!=before:raise RuntimeError('concurrent_source_preserved')
                    s.posix_rename(stage,remote)
                finally:
                    try:s.remove(stage)
                    except FileNotFoundError:pass
            with s.open(remote,'rb') as f:
                if f.read()!=desired:raise RuntimeError('production_source_mismatch')
            print('UPLOAD_SOURCE_DEPLOYED',hashlib.sha256(desired).hexdigest(),flush=True)
            with s.open('/hosting/noastudio/noa-ai-lab/worker.key','rb') as f:key=f.read(129).decode().strip()
            if len(key)!=64:raise RuntimeError('invalid_service_key')
            call=signed_service(key)
            def probe(recover=False):
                req=urllib.request.Request('https://noastudio.ai.kr/'+name,headers={'X-NOA-Diagnostic':token,'X-NOA-Recover':'1' if recover else '0'})
                with urllib.request.urlopen(req,timeout=90) as response:return json.load(response)
            try:
                with s.open(ROOT+'/'+name,'wx') as f:f.write(code)
                s.chmod(ROOT+'/'+name,0o644)
                initial=probe(True)
                print('UPLOAD_RECOVERY_QUEUED',initial['job']['id'],initial['upload']['status'],flush=True)
                def mkdir(path,mode):
                    try:s.mkdir(path,mode)
                    except OSError:
                        if not stat.S_ISDIR(s.lstat(path).st_mode) or s.normalize(path)!=path:raise
                result=process_uploads(s,call,mkdir,worker_identity={'run_id':os.environ['GITHUB_RUN_ID'],'source_commit':os.environ['GITHUB_SHA'],'keepalive_seconds':0})
                print('UPLOAD_RECOVERY_WORKER',json.dumps(result),flush=True)
                final=probe()
                deadline=time.monotonic()+240
                while final['upload']['status'] in ('queued','retrying','analyzing','processing','verifying') and time.monotonic()<deadline:
                    time.sleep(5)
                    final=probe()
                if final['upload']['status']!='ready' or final['asset']['status']!='ready':raise RuntimeError('recovery_not_ready')
                a=final['asset'];source=json.loads(a['source_analysis'])
                if source['sha256']!=final['upload']['sha256']:raise RuntimeError('source_identity_mismatch')
                path='/hosting/noastudio/noa-jukebox-private/media/'+a['audio_path']
                dest=out/'verified.mp3'
                s.get(path,str(dest))
                if media.digest(dest)!=a['audio_sha256'] or dest.stat().st_size!=a['audio_bytes']:raise RuntimeError('final_hash_mismatch')
                analysis=media.analyze(dest)
                if analysis['codec']!='mp3' or analysis['channels']!=2 or analysis['true_peak'] is None or analysis['true_peak']>-1 or analysis['decode_errors']:raise RuntimeError('downloaded_audio_invalid')
                dest.unlink()
                proof={'key':final['key'],'status':'ready','job_id':final['job']['id'],'audio_path':a['audio_path'],'audio_sha256':a['audio_sha256'],'bytes':a['audio_bytes'],'analysis':analysis,'source_identity_verified':True,'source_retained':final['source_verified'],'deployed_sha256':hashlib.sha256(desired).hexdigest()}
                (out/'result.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2))
                print('UPLOAD_RECOVERY_VERIFIED',json.dumps(proof,ensure_ascii=False),flush=True)
            finally:s.remove(ROOT+'/'+name)
    finally:t.close()
if __name__=='__main__':main()
