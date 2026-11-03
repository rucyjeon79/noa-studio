"""Read-only diagnosis of one failed upload; temporary authenticated probe is removed."""
import hashlib,json,os,secrets,urllib.request
from pathlib import Path
import paramiko
from noa_full_inventory import connect,ROOT
PHP = "<?php\ndeclare(strict_types=1);\nini_set('display_errors','0');\nif(!hash_equals('__TOKEN_HASH__',hash('sha256',$_SERVER['HTTP_X_NOA_DIAGNOSTIC']??''))){http_response_code(403);exit;}\nrequire __DIR__.'/common.php';require __DIR__.'/noa-bridge/storage.php';require __DIR__.'/noa-bridge/sound-core.php';require __DIR__.'/noa-bridge/lab-core.php';require __DIR__.'/noa-app/jukebox/operations.php';\nif(session_status()===PHP_SESSION_ACTIVE)session_write_close();\nheader('Content-Type: application/json');\n$db=noa_bridge_pdo();$key='single:pop-original:32';\n$q=$db->prepare('SELECT * FROM noa_jukebox_uploads WHERE song_key=? ORDER BY sequence DESC LIMIT 1');$q->execute([$key]);$u=$q->fetch(PDO::FETCH_ASSOC);\n$a=nj_find($db,$key);$d=nj_document($db,$key);\n$out=['key'=>$key,'upload'=>array_intersect_key($u,array_flip(['id','status','error','source_url','previous_sha256','sha256','file_bytes','source_analysis','correction','final_analysis'])),'asset'=>$a,'source_current'=>noa_sound_suno($d['body']??[]),'source_verified'=>nr_reconcile($db,$key,$u['id'])['source_verified'],'job'=>nq_latest($db,$u['id'])];\n$dir=dirname(nj_file($a['cover_path'])?:'');$out['output_files']=[];\nif($dir&&is_dir($dir)){foreach(glob($dir.'/*') as $p)if(is_file($p))$out['output_files'][]=['name'=>basename($p),'bytes'=>filesize($p),'sha256'=>hash_file('sha256',$p)];}\necho json_encode($out,JSON_THROW_ON_ERROR);\n"
def main():
    token=secrets.token_hex(32)
    code=PHP.replace('__TOKEN_HASH__',hashlib.sha256(token.encode()).hexdigest()).encode()
    name='noa-upload-probe-'+secrets.token_hex(12)+'.php'
    t=connect()
    try:
        with paramiko.SFTPClient.from_transport(t) as s:
            s.get_channel().settimeout(45)
            try:
                with s.open(ROOT+'/'+name,'wx') as f:f.write(code)
                s.chmod(ROOT+'/'+name,0o644)
                request=urllib.request.Request('https://noastudio.ai.kr/'+name,headers={'X-NOA-Diagnostic':token})
                with urllib.request.urlopen(request,timeout=90) as response:result=json.load(response)
                Path('upload-diagnosis-proof').mkdir(exist_ok=True)
                Path('upload-diagnosis-proof/result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
                print('UPLOAD_DIAGNOSIS',json.dumps(result,ensure_ascii=False))
            finally:s.remove(ROOT+'/'+name)
    finally:t.close()
if __name__=='__main__':main()
