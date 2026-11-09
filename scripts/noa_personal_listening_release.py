"""Activate the personal listening module after isolated PHP/DB/browser verification."""
import hashlib
import os
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
 'noa-app/engine/personal-song-index.php':'deploy/noa-app/engine/personal-song-index.php',
 'noa-bridge/youtube-catalog.php':'bridge/youtube-catalog.php',
 'noa-bridge/listening-video-catalog.php':'bridge/listening-video-catalog.php',
 'noa-bridge/listening-weather-editions.php':'bridge/listening-weather-editions.php',
 'noa-bridge/listening-care-core.php':'bridge/listening-care-core.php',
 'noa-app/engine/song-generation.php':'deploy/noa-app/engine/song-generation.php',
 'noa-bridge/listening-care.php':'bridge/listening-care.php',
 'noa-bridge/listening-weather.php':'bridge/listening-weather.php',
 'noa-bridge/listening-videos.php':'bridge/listening-videos.php',
 'noa-bridge/lab-worker.php':'bridge/lab-worker.php',
 'noa-bridge/notifications-inline.php':'bridge/notifications-inline.php',
 'noa-bridge/notifications-sources.php':'bridge/notifications-sources.php',
 'noa-bridge/notifications-core.php':'bridge/notifications-core.php',
 'noa-bridge/notification-worker.php':'bridge/notification-worker.php',
 'noa-bridge/listening.php':'bridge/listening.php',
 'noa-listening-model.js':'deploy/noa-listening-model.js',
 'noa-listening.js':'deploy/noa-listening.js',
 'noa-browse.js':'deploy/noa-browse.js',
 'noa-listening.css':'deploy/noa-listening.css',
 'noa-interface-labels.json':'deploy/noa-interface-labels.json',
 'noa-ui.js':'deploy/noa-ui.js',
 'noa-app/engine/n80.php':'deploy/noa-app/engine/n80.php',
 'noa-music.php':'deploy/noa-music.php',
 'noa-app/p0-player.js':'deploy/noa-app/p0-player.js',
 'noa-launch.js':'deploy/noa-launch.js',
 'noa-account.js':'deploy/noa-account.js',
 'noa-app/home.php':'deploy/noa-app/home.php',
}
release.NEW=set(release.FILES)-{'noa-interface-labels.json','noa-bridge/youtube-catalog.php','noa-bridge/lab-worker.php','noa-app/p0-player.js','noa-launch.js','noa-account.js','noa-app/engine/n80.php','noa-music.php','noa-app/home.php','noa-ui.js','noa-browse.js','noa-bridge/notifications-inline.php','noa-bridge/notifications-sources.php','noa-bridge/notifications-core.php','noa-bridge/notification-worker.php'}
if os.environ.get('NOA_LISTENING_COPY') == 'true':
    names = ('noa-interface-labels.json', 'noa-browse.js', 'noa-listening.css', 'noa-listening.js', 'noa-music.php', 'noa-ui.js')
    release.FILES = {name: 'deploy/' + name for name in names}
    release.NEW = set()
if os.environ.get('NOA_MIND_WEATHER') == 'true':
    paths = ['noa-bridge/member-access.php','noa-bridge/legacy-audio.php','noa-app/jukebox/stream.php','noa-bridge/listening-weather.php','noa-bridge/listening.php','noa-listening.css','noa-listening.js','noa-music.php','noa-app/home.php']
    release.FILES = {p:('bridge/'+p.split('/')[-1] if p.startswith('noa-bridge/') else 'deploy/'+p) for p in paths}
    release.NEW = {'noa-bridge/listening-weather.php'}
if os.environ.get('NOA_VIP_CARE') == 'true':
    paths = ['noa-bridge/listening-weather-editions.php','noa-bridge/listening-care-core.php','noa-app/engine/song-generation.php','noa-bridge/listening-care.php','noa-bridge/listening-weather.php','noa-listening.css','noa-listening.js','noa-music.php','noa-app/home.php']
    release.FILES = {p:('bridge/'+p.split('/')[-1] if p.startswith('noa-bridge/') else 'deploy/'+p) for p in paths}
    release.NEW = set(paths[:2]+['noa-bridge/listening-care.php'])
if os.environ.get('NOA_MOOD_COLLECTIONS') == 'true':
    paths = ('noa-listening-model.js','noa-listening.js','noa-app/engine/personal-listening.php','noa-app/home.php','noa-music.php','noa-interface-labels.json','noa-ui.js','noa-bridge/lab-worker.php')
    release.FILES = {p: release.FILES[p] for p in paths}
    release.NEW = set()
if os.environ.get('NOA_LISTENING_NAVIGATION') == 'true':
    release.FILES = {'noa-listening.js':'deploy/noa-listening.js'}
    release.NEW = set()
release.PROTECTED=[p for p in release.PROTECTED if p not in release.FILES]
release.EXTRA_KNOWN={p:{hashlib.sha256(Path(local).read_bytes()).hexdigest()} for p,local in release.FILES.items() if 'calendar-vendor' in p or 'korean-months' in p or 'calendar-LICENSE' in p}
if __name__=='__main__':release.main()
