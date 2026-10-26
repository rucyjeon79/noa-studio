"""Five reviewed preview/header sources, using the existing SHA-guarded atomic transport."""
import noa_ainoa_deploy as release
release.FILES={'noa-bridge/youtube-catalog.php':'bridge/youtube-catalog.php','noa-browse.js':'deploy/noa-browse.js','noa-account.js':'deploy/noa-account.js','noa-account.css':'deploy/noa-account.css'}
release.FILES['noa-browse-edit.js']='deploy/noa-browse-edit.js'
release.NEW=set()
release.PROTECTED+=['bbs/logout.php','noa-youtube.php','noa-category-order.php','noa-ui.js','noa-ui.css','extend/noa.00-membership.php']
if __name__=='__main__':
 release.main()
 if 'rollback' not in release.sys.argv:
  from pathlib import Path
  import shutil
  Path('preview-proof').mkdir(exist_ok=True)
  shutil.copy('ainoa-proof/deployment.json','preview-proof/deployment.json')
