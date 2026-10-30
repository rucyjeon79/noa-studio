"""Scoped source-only ecosystem deployment. No synthetic production content or transactions."""
import sys,stat
from pathlib import Path
import noa_ainoa_deploy as release
from noa_full_inventory import connect,ROOT
import paramiko
release.FILES={
 'noa-bridge/ecosystem-core.php':'bridge/ecosystem-core.php',
 'noa-bridge/ecosystem-shop.php':'bridge/ecosystem-shop.php',
 'noa-bridge/ecosystem.php':'bridge/ecosystem.php',
 'noa-bridge/support-settlement.php':'bridge/support-settlement.php',
 'noa-bridge/support-core.php':'bridge/support-core.php',
 'noa-bridge/support.php':'bridge/support.php',
 'noa-products.json':'deploy/noa-products.json',
 'noa-ecosystem.css':'deploy/noa-ecosystem.css',
 'noa-ecosystem.js':'deploy/noa-ecosystem.js',
 'noa-ecosystem-links.js':'deploy/noa-ecosystem-links.js',
 'noa-settlement.js':'deploy/noa-settlement.js',
 'noa-app/ecosystem-view.php':'deploy/noa-app/ecosystem-view.php',
 'noa-shop.php':'deploy/noa-shop.php',
 'noa-lounge.php':'deploy/noa-lounge.php',
 'noa-creator-lab.php':'deploy/noa-creator-lab.php',
 'noa-support.php':'deploy/noa-support.php',
 'noa-channel-workspace.php':'deploy/noa-channel-workspace.php',
 'noa-sitemap.php':'deploy/noa-sitemap.php',
 'extend/zz.noa-engagement.php':'deploy/noa-engagement.extend.php',
}
assets={str(p.relative_to('deploy')):str(p)for p in sorted(Path('deploy/noa-assets/ecosystem').glob('*'))if p.is_file()}
release.FILES={**assets,**release.FILES}
existing={'noa-bridge/support-core.php','noa-bridge/support.php','noa-support.php','noa-channel-workspace.php','noa-sitemap.php','extend/zz.noa-engagement.php'}
release.NEW=set(release.FILES)-existing
release.PROTECTED+=['noa-bridge/subscription-core.php','noa-bridge/toss-core.php','noa-bridge/member-access.php','noa-browse.js']
if __name__=='__main__':
 try:
  release.check_current_candidate()
  t=connect()
  try:
   with paramiko.SFTPClient.from_transport(t)as s:
    p=ROOT+'/noa-assets/ecosystem'
    try:
     info=s.lstat(p)
     if not stat.S_ISDIR(info.st_mode):raise RuntimeError('non_directory_assets')
    except FileNotFoundError:s.mkdir(p,mode=0o755)
  finally:t.close()
  release.main()
 except Exception:
  if 'rollback' not in sys.argv and release.BACKUP.exists():
   sys.argv.append('rollback');release.main()
  raise
