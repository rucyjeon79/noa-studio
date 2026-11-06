"""Exercise the installed PHP extractor on public artwork, without changing a catalog record."""
import hashlib
import json
import secrets
import time
import urllib.request

import paramiko
from noa_full_inventory import ROOT, connect

PROBE = """<?php
declare(strict_types=1);
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||time()>__UNTIL__||!hash_equals('__HASH__',hash('sha256',$_SERVER['HTTP_X_NOA_PROBE']??''))){http_response_code(404);exit;}
require dirname(__DIR__).'/common.php';
require __DIR__.'/storage.php';
require __DIR__.'/sound-core.php';
require __DIR__.'/suno-cover.php';
$key='probe:'.bin2hex(random_bytes(12));$file=null;
try {
 $db=noa_bridge_pdo();
 $rows=$db->query("SELECT payload FROM noa_documents WHERE kind IN ('single','story') AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.visibility'))='public' AND (JSON_EXTRACT(payload,'$.body.sunoUrl') IS NOT NULL OR JSON_EXTRACT(payload,'$.body.sunoShareUrl') IS NOT NULL) ORDER BY updated_at DESC LIMIT 30");
 $sources=['https://suno.com/s/3T0G9aGwwrsnYXPz'];
 foreach($rows as $row){$doc=json_decode($row['payload'],true);if(noa_sound_visible($doc,false)&&($url=noa_sound_suno($doc['body']??[])))$sources[]=$url;}
 $card=null;
 foreach(array_slice(array_unique($sources),0,3) as $source){$card=nsc_prepare($db,$key,$source);if($card)break;}
 if(!$card)throw new RuntimeException('public_artwork_unavailable');
 [$path,$hash]=nsc_file(null,$key,$card['bytes']);$file=nj_file($path);
 $size=getimagesize($file);header('Content-Type: application/json');echo json_encode(['verified'=>true,'type'=>$size['mime'],'width'=>$size[0],'height'=>$size[1],'bytes'=>filesize($file)]);
}finally{if($file){unlink($file);rmdir(dirname($file));}}
"""

def main():
    token = secrets.token_hex(32)
    name = '.suno-editor-' + secrets.token_hex(12) + '.php'
    # HTTP must be able to call the temporary diagnostic on hosts that deny dot files.
    name = name.lstrip('.')
    path = ROOT + '/noa-bridge/' + name
    source = PROBE.replace('__HASH__', hashlib.sha256(token.encode()).hexdigest()).replace('__UNTIL__', str(int(time.time())+180))
    transport = connect()
    try:
        with paramiko.SFTPClient.from_transport(transport) as sftp:
            try:
                with sftp.open(path, 'wx') as out:
                    out.write(source.encode())
                request = urllib.request.Request('https://noastudio.ai.kr/noa-bridge/'+name, data=b'', headers={'X-NOA-Probe':token})
                with urllib.request.urlopen(request, timeout=60) as response:
                    result = json.load(response)
                if not result.get('verified') or result.get('type') != 'image/webp':
                    raise RuntimeError('live_artwork_verification_failed')
                print('LIVE_SUNO_CARD', json.dumps(result))
            finally:
                sftp.remove(path)
    finally:
        transport.close()

if __name__ == '__main__':
    main()
