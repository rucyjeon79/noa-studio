"""Insert missing byte-exact source archives over the existing pinned SSH connection."""
import base64
import gzip
import hashlib
import json
from pathlib import Path
import re
import pymysql

def read_literal(config, name):
    pattern = r"define\s*\(\s*['\"]" + re.escape(name) + r"['\"]\s*,\s*'((?:\\.|[^'\\])*)'\s*\)"
    match = re.search(pattern, config)
    if not match:
        raise ValueError('Unsupported database configuration literal')
    return re.sub(r"\\([\\'])", r"\1", match.group(1))

def seed(path):
    encoded = re.search(r"base64_decode\('([^']+)'", Path(path).read_text()).group(1)
    return json.loads(gzip.decompress(base64.b64decode(encoded)))

def migrate(transport, sftp, root):
    # Configuration stays in process memory and is never printed or written to GitHub.
    with sftp.open(root+'/data/dbconfig.php', 'rb') as handle:
        config = handle.read().decode('utf-8-sig')
    values = {n: read_literal(config, 'G5_MYSQL_'+n) for n in ['HOST','USER','PASSWORD','DB']}
    host = '127.0.0.1' if values['HOST']=='localhost' else values['HOST']
    if not re.fullmatch(r'[a-zA-Z0-9.\-]+',host):
        raise ValueError('Unsupported database host')
    channel = transport.open_channel('direct-tcpip',(host,3306),('127.0.0.1',0),timeout=15)
    db = pymysql.connect(host=host,user=values['USER'],password=values['PASSWORD'],database=values['DB'],
                         charset='utf8mb4',defer_connect=True,read_timeout=45,write_timeout=45)
    try:
        db.connect(sock=channel)
        with db.cursor() as cursor:
            cursor.execute('SHOW TABLES')
            tables = {row[0] for row in cursor.fetchall()}
            if not {'noa_documents','noa_document_history'}.issubset(tables):
                raise RuntimeError('Existing music storage unavailable')
            legacy = sorted(t for t in tables if re.fullmatch(r'g5_(member|board|write_[a-z0-9_]+)',t))
            def counts():
                result={}
                for name in legacy:
                    cursor.execute('SELECT COUNT(*) FROM '+name)
                    result[name]=cursor.fetchone()[0]
                return result
            before=counts()
            if 'noa_source_files' in tables:
                cursor.execute('SHOW COLUMNS FROM noa_source_files')
                if not {'path_hash','source_path','sha256','source_bytes','imported_at'}.issubset({r[0] for r in cursor.fetchall()}):
                    raise RuntimeError('Archive schema conflict')
            else:
                cursor.execute("""CREATE TABLE noa_source_files (
                  path_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
                  source_path VARCHAR(512) NOT NULL,
                  sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
                  source_bytes MEDIUMBLOB NOT NULL,
                  imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci""")
            source=seed('bridge/source-archive.php')['files']
            if len(source)!=731: raise RuntimeError('Unexpected source count')
            cursor.execute('SELECT path_hash,sha256,source_bytes FROM noa_source_files')
            known={row[0]:(row[1],bytes(row[2])) for row in cursor.fetchall()}
            pending=[];conflicts=[];same=0
            for file in source:
                raw=base64.b64decode(file['base64'],validate=True)
                if hashlib.sha256(raw).hexdigest()!=file['sha256']:raise RuntimeError('Invalid source bytes')
                key=hashlib.sha256(file['path'].encode()).hexdigest()
                if key in known:
                    if known[key]!=(file['sha256'],raw):conflicts.append(file['path'])
                    else:same+=1
                else:pending.append((key,file['path'],file['sha256'],raw))
            if conflicts:raise RuntimeError('Existing source conflicts; nothing overwritten')
            db.begin()
            for start in range(0,len(pending),40):
                cursor.executemany('INSERT INTO noa_source_files(path_hash,source_path,sha256,source_bytes) VALUES(%s,%s,%s,%s)',pending[start:start+40])
            cursor.execute('SELECT path_hash,sha256,source_bytes FROM noa_source_files')
            saved={r[0]:(r[1],hashlib.sha256(bytes(r[2])).hexdigest()) for r in cursor.fetchall()}
            for f in source:
                if saved.get(hashlib.sha256(f['path'].encode()).hexdigest())!=(f['sha256'],f['sha256']):
                    raise RuntimeError('Archive integrity mismatch')
            cursor.execute('SELECT doc_key,payload FROM noa_documents')
            documents={r[0]:json.loads(r[1]) for r in cursor.fetchall()}
            expected=seed('bridge/seed.php')['items'];missing=[];different=[];matching=0
            canonical=lambda v:json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(',',':'))
            for item in expected:
                if item['key'] not in documents:missing.append(item['key'])
                elif canonical(documents[item['key']])!=canonical(item['payload']):different.append(item['key'])
                else:matching+=1
            after=counts()
            if before!=after:raise RuntimeError('Legacy table counts changed concurrently')
            db.commit()
            print('SOURCE_MIGRATION',json.dumps({'archive_source':731,'added':len(pending),'unchanged':same,
                'verified':731,'conflicts':0,'music_source':len(expected),'music_matching':matching,
                'music_missing':missing,'music_different_preserved':different,'legacy_counts_unchanged':True},ensure_ascii=False))
            if missing or different:raise RuntimeError('Music source differences require review')
    except BaseException:
        db.rollback()
        raise
    finally:
        db.close()
