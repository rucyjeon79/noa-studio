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
        # Reuse the existing SSH database tunnel; credentials stay in memory.
        import gzip
        import re
        import pymysql
        with sftp.open(root + '/data/dbconfig.php', 'rb') as handle:
            configuration = handle.read().decode('utf-8-sig')
        def value(name):
            pattern = r"define\s*\(\s*['\"]G5_MYSQL_" + name + r"['\"]\s*,\s*'((?:\\.|[^'\\])*)'\s*\)"
            match = re.search(pattern, configuration)
            if not match:
                raise RuntimeError('Unsupported database configuration')
            return re.sub(r"\\([\\'])", r"\1", match.group(1))
        dbhost = value('HOST')
        dbhost = '127.0.0.1' if dbhost == 'localhost' else dbhost
        if not re.fullmatch(r'[a-zA-Z0-9.\-]+', dbhost):
            raise RuntimeError('Unsupported database host')
        tunnel = connection.open_channel('direct-tcpip', (dbhost,3306), ('127.0.0.1',0), timeout=15)
        db = pymysql.connect(host=dbhost,user=value('USER'),password=value('PASSWORD'),database=value('DB'),charset='utf8mb4',defer_connect=True,read_timeout=45,write_timeout=45)
        try:
            db.connect(sock=tunnel)
            with db.cursor() as cursor:
                cursor.execute('SET TRANSACTION READ ONLY')
                cursor.execute('START TRANSACTION WITH CONSISTENT SNAPSHOT')
                summary = {}
                for table in ['noa_documents','noa_document_history','noa_source_files','g5_member']:
                    cursor.execute('SELECT COUNT(*) FROM ' + table)
                    summary[table] = cursor.fetchone()[0]
                cursor.execute('SELECT doc_key,payload FROM noa_documents')
                saved = {key:json.loads(payload) for key,payload in cursor.fetchall()}
                with sftp.open(root + '/noa-bridge/seed.php','rb') as handle:
                    seed_code = handle.read().decode()
                encoded = re.search(r"base64_decode\('([^']+)'",seed_code).group(1)
                seed = json.loads(gzip.decompress(base64.b64decode(encoded)))['items']
                music = {'expected':len(seed),'present':0,'unchanged':0,'different_preserved':0,'missing':0}
                for item in seed:
                    if item['key'] not in saved:
                        music['missing'] += 1
                        continue
                    music['present'] += 1
                    music['unchanged' if saved[item['key']] == item['payload'] else 'different_preserved'] += 1
                summary['music'] = music
                cursor.execute('SELECT sha256,source_bytes FROM noa_source_files')
                archive = cursor.fetchall()
                summary['archive_bytes_verified'] = sum(hashlib.sha256(bytes(raw)).hexdigest() == digest for digest,raw in archive)
                db.rollback()
                print(json.dumps({'database_read_only':summary}))
                if music['missing']:
                    raise RuntimeError('Source music document missing')
                if summary['archive_bytes_verified'] != len(archive):
                    raise RuntimeError('Source archive checksum mismatch')
        finally:
            db.close()
    finally:
        connection.close()

if __name__ == '__main__':
    main()
