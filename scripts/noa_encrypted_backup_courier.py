"""One-time encrypted courier. Only ciphertext may be uploaded as an artifact."""
import base64
import hashlib
import json
import os
from pathlib import Path
import tarfile
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

AAD = b'NOA-SQL-TRANSFER-20261024-v1'


def main():
    base = Path(os.environ['RUNNER_TEMP'])
    source = base / 'noa-db-backups'
    out = base / 'noa-encrypted-courier'
    out.mkdir(mode=0o700)
    public = serialization.load_pem_public_key(Path('scripts/noa_courier_public.pem').read_bytes())
    key, nonce = os.urandom(32), os.urandom(12)
    encrypt = Cipher(algorithms.AES(key), modes.GCM(nonce)).encryptor()
    encrypt.authenticate_additional_data(AAD)
    archive = base / 'noa-private-courier.tar.gz'
    with tarfile.open(archive, 'w:gz') as tar:
        for path in sorted(source.iterdir()):
            if not path.is_file() or path.is_symlink():
                raise RuntimeError('unsafe_courier_source')
            tar.add(path, arcname=path.name, recursive=False)
    h = hashlib.sha256()
    with archive.open('rb') as src, (out / 'backup.enc').open('wb') as dst:
        while chunk := src.read(1048576):
            h.update(chunk)
            dst.write(encrypt.update(chunk))
        dst.write(encrypt.finalize())
    envelope = {
        'version': 1, 'cipher': 'AES-256-GCM+RSA-OAEP-SHA256',
        'nonce': base64.b64encode(nonce).decode(),
        'tag': base64.b64encode(encrypt.tag).decode(),
        'wrapped_key': base64.b64encode(public.encrypt(key, padding.OAEP(
            mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=AAD))).decode(),
        'plaintext_archive_sha256': h.hexdigest(),
    }
    (out / 'envelope.json').write_text(json.dumps(envelope))
    archive.unlink()
    print('ENCRYPTED_COURIER_READY; no SQL plaintext artifact; hosting unchanged')


if __name__ == '__main__':
    main()
