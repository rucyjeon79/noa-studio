"""Read deployed public CSS/JS through the pinned host connection; never write remotely."""
import hashlib
import json
import os
from pathlib import Path
import stat
import paramiko
from noa_full_inventory import ROOT, connect, mappings

MAX_ASSET_BYTES = 4 * 1024 * 1024


def read_asset(sftp, path):
    remote = ROOT + '/' + path
    try:
        before = sftp.lstat(remote)
    except FileNotFoundError:
        return None
    if not stat.S_ISREG(before.st_mode) or sftp.normalize(remote) != remote:
        raise RuntimeError('unsafe_baseline_asset:' + path)
    if not 0 <= before.st_size <= MAX_ASSET_BYTES:
        raise RuntimeError('oversize_baseline_asset:' + path)
    with sftp.open(remote, 'rb') as stream:
        data = stream.read(MAX_ASSET_BYTES + 1)
    after = sftp.lstat(remote)
    if (before.st_size, before.st_mtime, before.st_mode) != (after.st_size, after.st_mtime, after.st_mode) or len(data) != before.st_size:
        raise RuntimeError('baseline_changed_during_read:' + path)
    return data


def main():
    output = Path(os.environ['N80_BASELINE_ASSETS'])
    output.mkdir(parents=True, exist_ok=False)
    transport = connect()
    assets = {}
    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        sftp.get_channel().settimeout(30)
        if sftp.normalize(ROOT) != ROOT:
            raise RuntimeError('unexpected_baseline_root')
        for path in mappings():
            if Path(path).suffix not in ('.css', '.js'):
                continue
            data = read_asset(sftp, path)
            # Unused source assets need not be deployed. Any requested missing asset
            # is a hard failure in the browser gate, never a candidate fallback.
            if data is None:
                continue
            target = output / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            assets['/' + path] = {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}
    finally:
        transport.close()
    if not assets:
        raise RuntimeError('empty_operating_baseline')
    (output / 'manifest.json').write_text(json.dumps({'source': 'pinned-production-sftp', 'assets': assets}, indent=2))
    print('N80_OPERATING_ASSET_SNAPSHOT ' + json.dumps({'files': len(assets), 'remoteWrites': 0}))


if __name__ == '__main__':
    main()
