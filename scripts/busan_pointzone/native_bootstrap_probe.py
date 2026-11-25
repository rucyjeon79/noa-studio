"""Temporary read-only bootstrap probe. No live config or member data changes."""
import hashlib,hmac,json,secrets
from pathlib import Path
from urllib.request import Request,urlopen
import release_submenu_fix as remote
from release_native_catalog_admin import lint
def probe(s):
    remote.directory(s,remote.ROOT+'/busan-assistant')
    token=secrets.token_hex(32)
    name='native-bootstrap-probe-'+secrets.token_hex(16)+'.php'
    dest=remote.ROOT+'/busan-assistant/'+name
    code=Path('scripts/busan_pointzone/native_bootstrap_probe.php').read_text().replace('__TOKEN_HASH__',hashlib.sha256(token.encode()).hexdigest()).encode()
    lint(code)
    try:
        with s.open(dest,'wx') as f:f.write(code)
        s.chmod(dest,0o644)
        request=Request('https://skhnslu-busan.com/busan-assistant/'+name,data=b'{}',headers={'X-Busan-Release':token})
        with urlopen(request,timeout=40) as response:
            result=json.load(response)
        print('BUSAN_NATIVE_BOOTSTRAP_PROBE',json.dumps(result,ensure_ascii=False),flush=True)
    finally:
        try:s.remove(dest)
        except FileNotFoundError:pass
if __name__=='__main__':
    host,user,password,pin=remote.configuration(remote.os.environ)
    with remote.socket.create_connection((host,remote.PORT),timeout=15) as sock,remote.paramiko.Transport(sock) as t:
        t.get_security_options().key_types=('ssh-ed25519',);t.start_client(timeout=20)
        if not hmac.compare_digest(remote.fingerprint(t.get_remote_server_key()),pin):raise RuntimeError('host identity mismatch')
        t.auth_password(user,password,fallback=False)
        with remote.paramiko.SFTPClient.from_transport(t) as s:
            s.get_channel().settimeout(35);probe(s)
