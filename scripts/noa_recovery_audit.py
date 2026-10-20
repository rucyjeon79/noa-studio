"""Read-only production inventory. Never prints payloads, members or credentials."""
import base64
import hashlib
import json
import os
from pathlib import Path
import paramiko
import noa_sftp_deploy as deployment

def main():
    connection = paramiko.Transport((os.environ['NOA_SSH_HOST'], 2022))
    try:
        connection.get_security_options().key_types = ('ssh-ed25519',)
        connection.start_client(timeout=20)
        fingerprint = 'SHA256:' + base64.b64encode(hashlib.sha256(connection.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
        if fingerprint != os.environ['NOA_SSH_HOST_FINGERPRINT']:
            raise RuntimeError('SSH host key mismatch')
        connection.auth_password(os.environ['NOA_SSH_USER'], os.environ['NOA_SSH_PASSWORD'])
        sftp = paramiko.SFTPClient.from_transport(connection)
        root = '/hosting/noastudio/html'
        if sftp.normalize(root) != root:
            raise RuntimeError('Unexpected production root')
        matches, different, missing = [], [], []
        for local, remote in deployment.FILES.items():
            path = Path(local)
            if not path.is_file():
                continue
            try:
                actual = deployment.digest(sftp, root + '/' + remote)
            except FileNotFoundError:
                missing.append(remote)
                continue
            (matches if actual == hashlib.sha256(path.read_bytes()).hexdigest() else different).append(remote)
        print(json.dumps({'files_matching_repository': matches, 'files_different_preserved': different, 'files_missing': missing}))
        # Existing credentials stay on the hosting server; SELECT statements only.
        php = '''define('_GNUBOARD_',true);require 'data/dbconfig.php';require 'noa-bridge/storage.php';$db=noa_bridge_pdo();$db->exec('SET TRANSACTION READ ONLY');$db->beginTransaction();$summary=[];foreach(['noa_documents','noa_document_history','noa_source_files'] as $table){$summary[$table]=(int)$db->query('SELECT COUNT(*) FROM '.$table)->fetchColumn();}$summary['document_kinds']=$db->query('SELECT kind,COUNT(*) AS total FROM noa_documents GROUP BY kind')->fetchAll(PDO::FETCH_ASSOC);$seed=require 'noa-bridge/seed.php';$get=$db->prepare('SELECT payload FROM noa_documents WHERE doc_key=?');$music=['expected'=>count($seed['items']),'present'=>0,'unchanged'=>0,'different_preserved'=>0,'missing'=>0];foreach($seed['items'] as $item){$get->execute([$item['key']]);$raw=$get->fetchColumn();if($raw===false){$music['missing']++;continue;}$music['present']++;if(json_decode($raw,true)===$item['payload'])$music['unchanged']++;else $music['different_preserved']++;}$summary['music']=$music;$db->rollBack();echo json_encode($summary,JSON_THROW_ON_ERROR).PHP_EOL;'''
        import shlex
        channel = connection.open_session(timeout=20)
        channel.settimeout(60)
        channel.exec_command('cd /hosting/noastudio/html && php -r ' + shlex.quote(php))
        output = channel.makefile('rb').read().decode()
        code = channel.recv_exit_status()
        if code:
            raise RuntimeError('Read-only inventory failed; remote exit ' + str(code))
        summary = json.loads(output)
        print(json.dumps({'database_read_only': summary}))
        if summary['music']['missing']:
            raise RuntimeError('Source music document missing')
    finally:
        connection.close()

if __name__ == '__main__':
    main()
