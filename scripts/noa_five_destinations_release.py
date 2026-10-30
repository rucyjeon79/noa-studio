"""Scoped navigation/theme release; preserve board data and all service logic."""
import sys
import noa_ainoa_deploy as release
release.FILES={
 'noa-ui.js':'deploy/noa-ui.js',
 'noa-starlight.css':'deploy/noa-starlight.css',
 'noa-app/ecosystem-view.php':'deploy/noa-app/ecosystem-view.php',
 'noa-ecosystem.js':'deploy/noa-ecosystem.js',
}
release.NEW=set()
release.PROTECTED += ['noa-bridge/community-core.php','noa-sitemap.php']
if __name__=='__main__':
 try: release.main()
 except Exception:
  if 'rollback' not in sys.argv and release.BACKUP.exists():
   sys.argv.append('rollback');release.main()
  raise
