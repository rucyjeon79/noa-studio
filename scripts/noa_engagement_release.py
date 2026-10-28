"""Guarded source release; existing core/content/member tables are not altered."""
import sys
from pathlib import Path
import noa_ainoa_deploy as release

release.FILES={
 'noa-bridge/engagement-core.php':'bridge/engagement-core.php',
 'noa-bridge/engagement-targets.php':'bridge/engagement-targets.php',
 'noa-bridge/engagement.php':'bridge/engagement.php',
 'noa-engagement.css':'deploy/noa-engagement.css',
 'noa-engagement.js':'deploy/noa-engagement.js',
 'noa-bridge/popularity-core.php':'bridge/popularity-core.php',
 'noa-bridge/popularity-store.php':'bridge/popularity-store.php',
 'extend/zz.noa-engagement.php':'deploy/noa-engagement.extend.php',
}
release.NEW={k for k in release.FILES if 'engagement' in k}
release.PROTECTED+=['bbs/write_comment_update.php','bbs/delete_comment.php','bbs/good.php','noa-bridge/community-core.php','noa-bridge/community.php']
if '--conversation' in sys.argv:
 sys.argv.remove('--conversation')
 release.FILES.update({
  'noa-bridge/community-core.php':'bridge/community-core.php',
  'noa-community.js':'deploy/noa-community.js',
  'noa-community.css':'deploy/noa-community.css',
  'noa-bridge/notifications-sources.php':'bridge/notifications-sources.php',
  'noa-bridge/notifications.php':'bridge/notifications.php',
  'noa-notifications.js':'deploy/noa-notifications.js',
  'noa-notifications.css':'deploy/noa-notifications.css',
 })
 release.PROTECTED.remove('noa-bridge/community-core.php')
if __name__=='__main__':
 release.main()
 if 'rollback' not in sys.argv:
  Path('engagement-proof').mkdir(exist_ok=True)
  Path('engagement-proof/deployment.json').write_bytes(Path('ainoa-proof/deployment.json').read_bytes())
