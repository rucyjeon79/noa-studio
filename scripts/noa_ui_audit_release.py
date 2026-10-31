"""Deploy reviewed UI and support flow only; no user data or point writes."""
import sys
import noa_ainoa_deploy as release
release.FILES={p:'deploy/'+p for p in ['noa-ui.css','noa-ui.js','noa-starlight.css','noa-ecosystem.js','noa-app/ecosystem-view.php','noa-support.css','noa-support.js','noa-points.php']}
release.NEW=set()
if __name__=='__main__':
 try: release.main()
 except Exception:
  if 'rollback' not in sys.argv and release.BACKUP.exists():
   sys.argv.append('rollback');release.main()
  raise
