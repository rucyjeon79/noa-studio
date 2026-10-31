"""Home/AInoa presentation only; no service or data mutations."""
import sys
import noa_ainoa_deploy as release
release.FILES={'noa-notifications.js':'deploy/noa-notifications.js'}
release.NEW=set()
release.PROTECTED += ['noa-ainoa.js','noa-voice.js','noa-ainoa.php']
if __name__=='__main__':
 try: release.main()
 except Exception:
  if 'rollback' not in sys.argv and release.BACKUP.exists():
   sys.argv.append('rollback');release.main()
  raise
