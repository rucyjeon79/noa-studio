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

import paramiko
from nacl.public import PrivateKey, SealedBox

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))
from busan_readonly_check import PORT, ROOT, configuration, fingerprint
from busan_news.release import ORIGIN, read, write

ASSET = '/data/editor/2611/busan-election-65acd106ec2b.webp'
DIGEST = '65acd106ec2b564cd0257cf6ea1ff49ae3e958510ae30315cdcb984f3e285a82'


def publish(sftp, poster):
    file_path = ROOT + ASSET
    if sftp.normalize(str(Path(file_path).parent)) != str(Path(file_path).parent):
        raise RuntimeError('Unexpected editor directory')
    old = read(sftp, file_path, len(poster))
    if old is None:
        write(sftp, file_path, poster, 0o644)
    elif old != poster:
        raise RuntimeError('Unexpected destination content')
    with urllib.request.urlopen(ORIGIN + ASSET, timeout=30) as response:
        if hashlib.sha256(response.read(len(poster) + 1)).hexdigest() != DIGEST:
            raise RuntimeError('Public image did not match')
    token = secrets.token_hex(32)
    endpoint = '/busan-assistant/popup-' + secrets.token_hex(16) + '.php'
    source = Path(__file__).with_name('apply.php').read_text()
    code = source.replace('__TOKEN_HASH__', hashlib.sha256(token.encode()).hexdigest()).encode()
    try:
        with sftp.open(ROOT + endpoint, 'wx') as stream:
            stream.write(code)
        sftp.chmod(ROOT + endpoint, 0o644)
        req = urllib.request.Request(ORIGIN + endpoint, data=b'', headers={'X-Busan-Popup': token})
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                if json.load(response) != {'ok': True}:
                    raise RuntimeError('Popup confirmation missing')
        except urllib.error.HTTPError as error:
            print('Popup update returned', error.code, error.read(150).decode(errors='replace'))
            raise
    finally:
        sftp.remove(ROOT + endpoint)


def main():
    tmp = Path(os.environ['RUNNER_TEMP'])
    box = SealedBox(PrivateKey((tmp / 'poster-private').read_bytes()))
    poster = box.decrypt((tmp / 'poster-sealed').read_bytes())
    if hashlib.sha256(poster).hexdigest() != DIGEST:
        raise RuntimeError('Wrong poster')
    host, user, password, pin = configuration(os.environ)
    with socket.create_connection((host, PORT), timeout=15) as sock, paramiko.Transport(sock) as transport:
        transport.get_security_options().key_types = ('ssh-ed25519',)
        transport.start_client(timeout=20)
        if not hmac.compare_digest(fingerprint(transport.get_remote_server_key()), pin):
            raise RuntimeError('Host key mismatch')
        transport.auth_password(user, password, fallback=False)
        with paramiko.SFTPClient.from_transport(transport) as client:
            client.get_channel().settimeout(45)
            publish(client, poster)
    for device in ['pc', 'mobile']:
        with urllib.request.urlopen(ORIGIN + '/?device=' + device, timeout=30) as response:
            page = response.read(2000000).decode()
            popup = page.split('id="hd_pops_1"', 1)[1].split('hd_pops_footer', 1)[0]
            if ASSET not in popup or 'wr_id=42' not in popup:
                raise RuntimeError(device + ' popup verification failed')
        print('Verified', device, 'homepage, notice link and poster')


if __name__ == '__main__':
    main()
