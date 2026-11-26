"""Publish exactly one pre-reviewed daily rights note via the existing pinned host path."""
import datetime as dt
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import socket
import sys
import urllib.error
import urllib.request
from zoneinfo import ZoneInfo
import paramiko
from release import configuration, fingerprint, PORT, ROOT, ORIGIN

QUEUE=Path('newsroom/rights-queue')
KST=ZoneInfo('Asia/Seoul')
def candidate(day):
    path=QUEUE/(day+'.json')
    if not path.is_file():
        raise RuntimeError('No reviewed rights note queued for '+day+'; refill required; no article published')
    row=json.loads(path.read_text())
    if row.get('publish_date')!=day or not row.get('slug') or not row.get('title') or len(row.get('body',[]))!=5:
        raise RuntimeError('Invalid reviewed daily rights candidate')
    return row

def publish(s,row):
    if s.normalize(ROOT)!=ROOT:
        raise RuntimeError('Unexpected hosting account')
    token=secrets.token_hex(32)
    name='news-import-'+secrets.token_hex(16)+'.php'
    dest=ROOT+'/busan-assistant/'+name
    worker=Path('scripts/busan_news/publish.php').read_text().replace('__TOKEN_HASH__',hashlib.sha256(token.encode()).hexdigest()).encode()
    try:
        with s.open(dest,'wx') as f: f.write(worker)
        s.chmod(dest,0o644)
        req=urllib.request.Request(ORIGIN+'/busan-assistant/'+name,data=json.dumps([row],ensure_ascii=False).encode(),
          headers={'X-Busan-News':token,'Content-Type':'application/json','X-Busan-News-Deploy-Mode':'rights-daily'})
        try:
            with urllib.request.urlopen(req,timeout=90) as response: result=json.load(response)
        except urllib.error.HTTPError as e:
            raise RuntimeError(f'Rights publication failed HTTP {e.code}; stage {e.headers.get("X-Busan-News-Stage")}; reason {e.headers.get("X-Busan-News-Reason")}') from None
        receipt=result.get('daily',{})
        if not result.get('ok') or receipt.get('date')!=row['publish_date'] or receipt.get('created') not in (0,1) or receipt.get('status') not in ('verified','already_published','already_published_today','existing_title_preserved'):
            raise RuntimeError('Invalid daily rights receipt')
        print('BUSAN_RIGHTS_DAILY_RECEIPT',json.dumps(receipt,ensure_ascii=False))
        if receipt.get('id'): print(ORIGIN+'/bbs/board.php?bo_table=note&wr_id='+str(receipt['id']))
    finally:
        try: s.remove(dest)
        except FileNotFoundError: pass

def main():
    if '--check' in sys.argv:
        files=sorted(QUEUE.glob('*.json'))
        if not files: raise RuntimeError('Empty queue')
        slugs=set()
        for f in files:
            row=candidate(f.stem)
            if row['slug'] in slugs: raise RuntimeError('Duplicate slug')
            slugs.add(row['slug'])
        print('PASS reviewed queue',len(files),'dates',files[0].stem,files[-1].stem)
        return
    now=dt.datetime.now(KST)
    if now.hour<8:
        print('Before scheduled release window; no publication'); return
    row=candidate(now.date().isoformat())
    host,user,password,pin=configuration(os.environ)
    with socket.create_connection((host,PORT),timeout=15) as sock,paramiko.Transport(sock) as t:
        t.get_security_options().key_types=('ssh-ed25519',)
        t.start_client(timeout=20)
        if not hmac.compare_digest(fingerprint(t.get_remote_server_key()),pin): raise RuntimeError('Host key mismatch')
        t.auth_password(user,password,fallback=False)
        with paramiko.SFTPClient.from_transport(t) as s:
            s.get_channel().settimeout(35)
            publish(s,row)

if __name__=='__main__': main()
