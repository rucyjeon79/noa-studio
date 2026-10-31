"""Release only SHOP presentation assets, preserving commerce state and orders."""
import sys
import noa_ainoa_deploy as release
release.FILES={'noa-ecosystem.js':'deploy/noa-ecosystem.js','noa-ecosystem.css':'deploy/noa-ecosystem.css'}
release.NEW=set()
if __name__=='__main__':
 try: release.main()
 except Exception:
  if 'rollback' not in sys.argv and release.BACKUP.exists():
   sys.argv.append('rollback');release.main()
  raise
