"""Member presentation only; reuse atomic publication, version guards and rollback."""
import sys
import noa_ainoa_deploy as release
release.FILES={
 'noa-member-surfaces.css':'deploy/noa-member-surfaces.css',
 'noa-member-surfaces.js':'deploy/noa-member-surfaces.js',
 'extend/noa.design.php':'deploy/noa-design.extend.php',
}
release.NEW={'noa-member-surfaces.css','noa-member-surfaces.js'}
if __name__=='__main__':
 try:release.main()
 except Exception:
  if 'rollback' not in sys.argv and release.BACKUP.exists():
   sys.argv.append('rollback');release.main()
  raise
