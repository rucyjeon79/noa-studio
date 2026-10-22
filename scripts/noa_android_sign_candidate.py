"""Re-sign the tested APK with the original installation key, supplied as CI secrets.

Never create a replacement identity. The following continuity check must still pass
before the production download pointer can change. Passwords remain environment
references in the apksigner command and are never printed or written to disk.
"""
import base64
import os
from pathlib import Path
import subprocess
import tempfile

required = (
    'NOA_ANDROID_KEYSTORE_BASE64', 'NOA_ANDROID_KEY_ALIAS',
    'NOA_ANDROID_KEYSTORE_PASSWORD', 'NOA_ANDROID_KEY_PASSWORD',
)
if any(not os.environ.get(name) for name in required):
    raise SystemExit('Original Android signing key is not configured. Production APK preserved.')

sdk = Path(os.environ.get('ANDROID_HOME', '/usr/local/lib/android/sdk'))
signers = sorted((sdk / 'build-tools').glob('*/apksigner'))
if not signers:
    raise SystemExit('Android signing verifier unavailable. Production APK preserved.')
apk = Path('artifact/app-debug.apk')
if not apk.is_file():
    raise SystemExit('Tested APK is missing. Production APK preserved.')

with tempfile.TemporaryDirectory(prefix='noa-sign-') as directory:
    key = Path(directory) / 'original.keystore'
    key.touch(mode=0o600)
    try:
        raw = base64.b64decode(os.environ['NOA_ANDROID_KEYSTORE_BASE64'], validate=True)
    except ValueError:
        raise SystemExit('Original signing key encoding is invalid. Production APK preserved.')
    if not 32 <= len(raw) <= 1024 * 1024:
        raise SystemExit('Original signing key size is invalid. Production APK preserved.')
    key.write_bytes(raw)
    signed = Path(directory) / 'signed.apk'
    subprocess.run([
        str(signers[-1]), 'sign', '--ks', str(key),
        '--ks-key-alias', os.environ['NOA_ANDROID_KEY_ALIAS'],
        '--ks-pass', 'env:NOA_ANDROID_KEYSTORE_PASSWORD',
        '--key-pass', 'env:NOA_ANDROID_KEY_PASSWORD',
        '--out', str(signed), str(apk),
    ], check=True, stdout=subprocess.DEVNULL)
    subprocess.run([str(signers[-1]), 'verify', '--verbose', str(signed)], check=True)
    apk.write_bytes(signed.read_bytes())
print('Tested APK signed; production certificate continuity check is still required.')
