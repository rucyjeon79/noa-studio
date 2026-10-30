"""Source-only support release. No synthetic production charges or payouts."""
import sys
from pathlib import Path
import noa_ainoa_deploy as release
release.FILES={
 'noa-bridge/support-core.php':'bridge/support-core.php',
 'noa-bridge/support.php':'bridge/support.php',
 'noa-support.php':'deploy/noa-support.php',
 'noa-support.css':'deploy/noa-support.css',
 'noa-support.js':'deploy/noa-support.js',
 'noa-sitemap.php':'deploy/noa-sitemap.php',
 'extend/zz.noa-engagement.php':'deploy/noa-engagement.extend.php',
}
release.NEW=set(release.FILES)-{'noa-sitemap.php','extend/zz.noa-engagement.php'}
release.PROTECTED+=['noa-bridge/subscription-core.php','noa-bridge/engagement.php','noa-browse.js','noa-bridge/member-access.php']
if __name__=='__main__':
 try:release.main()
 except Exception:
  if 'rollback' not in sys.argv and release.BACKUP.exists():
   sys.argv.append('rollback');release.main()
  raise
