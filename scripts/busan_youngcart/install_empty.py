import base64,hashlib,hmac,json,os,secrets,socket,stat,sys
from pathlib import Path
from urllib.request import Request,urlopen
import paramiko
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from busan_readonly_check import configuration,fingerprint,PORT,ROOT

def install(s):
    if s.normalize(ROOT)!=ROOT or not stat.S_ISDIR(s.lstat(ROOT+'/busan-assistant').st_mode):
        raise RuntimeError('unexpected busan root')
    token=secrets.token_hex(32)
    schema=Path('deploy/busan/youngcart/schema/youngcart-v5.6.4-create-only.sql').read_bytes()
    code=Path('scripts/busan_youngcart/install_empty.php').read_text().replace('__TOKEN_HASH__',hashlib.sha256(token.encode()).hexdigest()).replace('__SCHEMA_BASE64__',base64.b64encode(schema).decode()).replace('__SCHEMA_HASH__',hashlib.sha256(schema).hexdigest()).encode()
    name='youngcart-schema-'+secrets.token_hex(16)+'.php'
    dest=ROOT+'/busan-assistant/'+name
    try:
        with s.open(dest,'wx') as f:f.write(code)
        s.chmod(dest,0o644)
        req=Request('https://skhnslu-busan.com/busan-assistant/'+name,data=b'{}',headers={'X-Busan-Yc-Schema':token,'Content-Type':'application/json'})
        with urlopen(req,timeout=40) as res: report=json.load(res)
        print('BUSAN_YOUNGCART_SCHEMA_RECEIPT',json.dumps(report,ensure_ascii=False))
        if report.get('status') not in ('created','already_empty') or report.get('tables')!=24 or report.get('engine')!='InnoDB' or report.get('product_rows')!=0 or report.get('order_rows')!=0 or report.get('shop_activated') is not False or report.get('member_point_mutations')!=0:
            raise RuntimeError('empty schema installation not verified')
    finally:
        s.remove(dest)

if __name__=='__main__':
    host,user,password,pin=configuration(os.environ)
    with socket.create_connection((host,PORT),timeout=15) as sock,paramiko.Transport(sock) as t:
        t.get_security_options().key_types=('ssh-ed25519',)
        t.start_client(timeout=20)
        if not hmac.compare_digest(fingerprint(t.get_remote_server_key()),pin):raise RuntimeError('host key mismatch')
        t.auth_password(user,password,fallback=False)
        with paramiko.SFTPClient.from_transport(t) as s:
            s.get_channel().settimeout(35)
            install(s)
