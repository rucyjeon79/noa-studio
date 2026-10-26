"""Install the three reviewed MUSIC service-read files with source guards and reversible preimages."""
import json,sys
from pathlib import Path
import noa_ainoa_deploy as release
release.FILES={'noa-bridge/music-proof-auth.php':'bridge/music-proof-auth.php','noa-bridge/member-access.php':'bridge/member-access.php','noa-app/engine/music-availability.php':'deploy/noa-app/engine/music-availability.php'}
release.NEW={'noa-bridge/music-proof-auth.php'}
if __name__=='__main__':
    release.main()
    if 'rollback' not in sys.argv:
        out=Path('music-proof');out.mkdir(exist_ok=True);(out/'deployment.json').write_bytes(Path('ainoa-proof/deployment.json').read_bytes())
