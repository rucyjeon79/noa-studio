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
if __name__=='__main__':
 release.main()
 if 'rollback' not in sys.argv:
  Path('engagement-proof').mkdir(exist_ok=True)
  Path('engagement-proof/deployment.json').write_bytes(Path('ainoa-proof/deployment.json').read_bytes())
