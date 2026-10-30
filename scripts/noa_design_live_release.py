"""Design-only release: no DB, payment, account, or media mutations."""
import sys
from pathlib import Path
import noa_ainoa_deploy as release
release.FILES={"noa-engagement.js":"deploy/noa-engagement.js","noa-engagement.css":"deploy/noa-engagement.css"}
release.NEW=set()
release.PROTECTED += ["noa-bridge/engagement.php","noa-bridge/engagement-core.php","noa-browse.js"]
if __name__ == "__main__":
 try: release.main()
 except Exception:
  if "rollback" not in sys.argv and release.BACKUP.exists():
   sys.argv.append("rollback");release.main()
  raise
