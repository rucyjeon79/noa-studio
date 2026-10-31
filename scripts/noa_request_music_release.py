"""Home/AInoa presentation only; no service or data mutations."""
import sys
import noa_ainoa_deploy as release
release.FILES={'noa-bridge/community-core.php':'bridge/community-core.php','noa-community.js':'deploy/noa-community.js','noa-community.css':'deploy/noa-community.css','noa-bridge/support.php':'bridge/support.php','noa-support.js':'deploy/noa-support.js'}
release.NEW=set()
release.PROTECTED += ['noa-ainoa.js','noa-voice.js','noa-ainoa.php']
if __name__=='__main__':
 try: release.main()
 except Exception:
  if 'rollback' not in sys.argv and release.BACKUP.exists():
   sys.argv.append('rollback');release.main()
  raise
