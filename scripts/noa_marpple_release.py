"""Deploy catalog reader before accepting scheduled snapshots."""
import sys
import noa_ainoa_deploy as release
release.FILES={'noa-bridge/ecosystem-catalog.php':'bridge/ecosystem-catalog.php','noa-bridge/ecosystem-shop.php':'bridge/ecosystem-shop.php','noa-ecosystem.js':'deploy/noa-ecosystem.js'}
release.NEW={'noa-bridge/ecosystem-catalog.php'}
if __name__=='__main__':
 try:release.main()
 except Exception:
  if release.BACKUP.exists():sys.argv.append('rollback');release.main()
  raise
