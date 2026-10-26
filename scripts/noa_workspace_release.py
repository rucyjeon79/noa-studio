"""Scoped classification, library and administrator workspace release; no data migration."""
import noa_ainoa_deploy as release
release.FILES={
 'noa-bridge/sound-core.php':'bridge/sound-core.php',
 'noa-bridge/library-records.php':'bridge/library-records.php',
 'noa-bridge/record-trash.php':'bridge/record-trash.php',
 'noa-workspace.php':'deploy/noa-workspace.php',
 'noa-bridge/catalog.php':'bridge/catalog.php',
 'noa-bridge/index.php':'bridge/index.php',
 'noa-bridge/youtube-store.php':'bridge/youtube-store.php',
 **{p:'deploy/'+p for p in ['noa-record-action.php','noa-catalog.js','noa-workspace.js','noa-browse.js','noa-browse-edit.js','noa-ui.css','noa-inline-edit.php','noa-catalog.php','noa-editor.php','noa-library.php','noa-ai-lab.php','noa-my.php','noa-sitemap.php','noa-music.php','noa-world.php','noa-youtube.php']},
 'extend/noa.design.php':'deploy/noa-design.extend.php',
}
release.NEW={'noa-bridge/library-records.php','noa-bridge/record-trash.php','noa-workspace.php','noa-workspace.js','noa-catalog.js','noa-record-action.php'}
release.PROTECTED=[p for p in release.PROTECTED if p not in release.FILES]+['index.php','noa-app/home.php','noa-youtube.js','noa-community.js','noa-bridge/community-core.php','noa-manifest.json','noa-sw.js','noa-android-release.json','noa-launch.js','noa-install.php','noa-bridge/member-access.php','extend/noa.access.php','noa-category-order.php','noa-browse-order.js','noa-bridge/package-record.php']
if __name__=='__main__':
 release.main()
 if 'rollback' not in release.sys.argv:
  from pathlib import Path
  import shutil
  Path('workspace-proof/live').mkdir(parents=True,exist_ok=True);shutil.copy('ainoa-proof/deployment.json','workspace-proof/live/deployment.json')
