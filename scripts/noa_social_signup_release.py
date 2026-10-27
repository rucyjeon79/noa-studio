"""Snapshot native signup for offline QA, then install two additive presentation files."""
import hashlib, json, os, sys
from pathlib import Path
import paramiko
import noa_ainoa_deploy as release
from noa_full_inventory import connect, ROOT

release.FILES = {
    'noa-social-signup.css': 'deploy/noa-social-signup.css',
    'extend/zz.noa-social-signup.php': 'deploy/noa-social-signup.extend.php',
}
release.NEW = set(release.FILES)
release.PROTECTED += ['plugin/social/register_member.php', 'plugin/social/register_member_update.php',
                      'extend/zz.noa-social.php', 'noa-bridge/social-policy.php']

def snapshot():
    out = Path('social-signup-proof/native')
    out.mkdir(parents=True, exist_ok=True)
    paths = ['skin/social/social_register_member.skin.php', 'mobile/skin/social/social_register_member.skin.php',
             'skin/social/consent_modal.inc.php', 'mobile/skin/social/consent_modal.inc.php',
             'skin/social/style.css', 'mobile/skin/social/style.css', 'css/default.css', 'css/mobile.css',
             'js/jquery-1.12.4.min.js', 'js/jquery.register_form.js', 'js/remodal/remodal.js',
             'js/remodal/remodal.css', 'js/remodal/remodal-default-theme.css',
             'noa-ui.css', 'noa-ui.js', 'noa-account.css', 'noa-gnuboard.css', 'noa-design.json']
    receipts = {}
    t = connect()
    try:
        with paramiko.SFTPClient.from_transport(t) as s:
            s.get_channel().settimeout(30)
            for path in paths:
                try:
                    with s.open(ROOT+'/'+path, 'rb') as f: data = f.read()
                except FileNotFoundError:
                    if path.endswith('consent_modal.inc.php'): continue
                    raise
                dest = out/path
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(data)
                receipts[path] = hashlib.sha256(data).hexdigest()
    finally:
        t.close()
    Path('social-signup-proof/native-hashes.json').write_text(json.dumps(receipts, indent=2))
    print('NATIVE_SOCIAL_SNAPSHOT_OK', len(receipts))

if __name__ == '__main__':
    if 'snapshot' in sys.argv: snapshot()
    else:
        release.main()
        if 'rollback' not in sys.argv:
            Path('social-signup-proof/deployment.json').write_bytes(Path('ainoa-proof/deployment.json').read_bytes())
