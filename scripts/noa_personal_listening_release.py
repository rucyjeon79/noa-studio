"""Activate the personal listening module after isolated PHP/DB/browser verification."""
import hashlib
from pathlib import Path
import noa_ainoa_deploy as release
from noa_release_freshness import BUSAN_ONLY_PATH_PREFIXES
release.UNRELATED_PATH_PREFIXES=BUSAN_ONLY_PATH_PREFIXES
release.FILES={
 'noa-app/engine/personal-calendar-vendor.php':'deploy/noa-app/engine/personal-calendar-vendor.php',
 'noa-app/engine/personal-korean-months.json':'deploy/noa-app/engine/personal-korean-months.json',
 'noa-app/engine/personal-calendar-LICENSE.txt':'deploy/noa-app/engine/personal-calendar-LICENSE.txt',
 'noa-app/engine/personal-genre-model.php':'deploy/noa-app/engine/personal-genre-model.php',
 'noa-app/engine/personal-listening.php':'deploy/noa-app/engine/personal-listening.php',
 'noa-bridge/notifications-inline.php':'bridge/notifications-inline.php',
 'noa-bridge/notifications-sources.php':'bridge/notifications-sources.php',
 'noa-bridge/notifications-core.php':'bridge/notifications-core.php',
 'noa-bridge/notification-worker.php':'bridge/notification-worker.php',
 'noa-bridge/listening.php':'bridge/listening.php',
 'noa-listening-model.js':'deploy/noa-listening-model.js',
 'noa-listening.js':'deploy/noa-listening.js',
 'noa-browse.js':'deploy/noa-browse.js',
 'noa-listening.css':'deploy/noa-listening.css',
 'noa-ui.js':'deploy/noa-ui.js',
 'noa-app/engine/n80.php':'deploy/noa-app/engine/n80.php',
 'noa-music.php':'deploy/noa-music.php',
 'noa-app/p0-player.js':'deploy/noa-app/p0-player.js',
 'noa-launch.js':'deploy/noa-launch.js',
 'noa-account.js':'deploy/noa-account.js',
 'noa-app/home.php':'deploy/noa-app/home.php',
}
release.NEW=set(release.FILES)-{'noa-app/p0-player.js','noa-launch.js','noa-account.js','noa-app/engine/n80.php','noa-music.php','noa-app/home.php','noa-ui.js','noa-browse.js','noa-bridge/notifications-inline.php','noa-bridge/notifications-sources.php','noa-bridge/notifications-core.php','noa-bridge/notification-worker.php'}
release.PROTECTED=[p for p in release.PROTECTED if p not in release.FILES]
release.EXTRA_KNOWN={p:{hashlib.sha256(Path(local).read_bytes()).hexdigest()} for p,local in release.FILES.items() if 'calendar-vendor' in p or 'korean-months' in p or 'calendar-LICENSE' in p}
if __name__=='__main__':release.main()
