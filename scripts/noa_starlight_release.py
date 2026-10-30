"""Starlight presentation release; source-hash guarded, no database writes."""
import os
import sys
import json
import urllib.request
from pathlib import Path
import noa_ainoa_deploy as release
# Independent BLOOM visibility maintenance does not change these presentation files.
release.UNRELATED_PATH_PREFIXES=('scripts/noa_bloom_publish.php','scripts/noa_bloom_publish.py','.github/workflows/noa-bloom-publish.yml')
release.FILES={
 'noa-editorial.css':'deploy/noa-editorial.css',
 'noa-app/editorial.php':'deploy/noa-app/editorial.php',
 'noa-assets/editorial-home-story.webp':'deploy/noa-assets/editorial/home-story.webp',
 'noa-assets/editorial-world-journey.webp':'deploy/noa-assets/editorial/world-journey.webp',
 'noa-assets/editorial-privacy-sanctuary.webp':'deploy/noa-assets/editorial/privacy-sanctuary.webp',
 'noa-assets/editorial-terms-promise.webp':'deploy/noa-assets/editorial/terms-promise.webp',
 'noa-assets/editorial-fans-stars.webp':'deploy/noa-assets/editorial/fans-stars.webp',
 'noa-assets/editorial-act-1.webp':'deploy/noa-assets/editorial/act-1.webp',
 'noa-assets/editorial-act-2.webp':'deploy/noa-assets/editorial/act-2.webp',
 'noa-assets/editorial-act-3.webp':'deploy/noa-assets/editorial/act-3.webp',
 'noa-assets/editorial-act-4.webp':'deploy/noa-assets/editorial/act-4.webp',

 'noa-home.js':'deploy/noa-home.js',
 'noa-bridge/home-core.php':'bridge/home-core.php',
 'noa-bridge/home-discovery.php':'bridge/home-discovery.php',
 'noa-bridge/popularity-store.php':'bridge/popularity-store.php',
 'noa-starlight.css':'deploy/noa-starlight.css',
 'noa-ui.css':'deploy/noa-ui.css',
 'noa-ui.js':'deploy/noa-ui.js',
 'noa-admin.css':'deploy/noa-admin.css',
 'noa-policy-20261024.css':'deploy/noa-policy-20261024.css',
 'noa-engagement.css':'deploy/noa-engagement.css',
 'noa-design.json':'deploy/noa-design.json',
 'noa-bridge/ui-preferences.php':'bridge/ui-preferences.php',
 'noa-sitemap.php':'deploy/noa-sitemap.php',
 'noa-settings.php':'deploy/noa-settings.php',
 'noa-theme-admin.php':'deploy/noa-theme-admin.php',
 'noa-bridge/world-story.php':'bridge/world-story.php',
 'noa-world.css':'deploy/noa-world.css',
 'noa-world.js':'deploy/noa-world.js',
 'noa-app/world-view.php':'deploy/noa-app/world-view.php',
 'noa-app/home.php':'deploy/noa-app/home.php',
 'extend/noa.design.php':'deploy/noa-design.extend.php',
}
release.NEW={'noa-starlight.css'}|{p for p in release.FILES if p.endswith('.webp')}
release.PROTECTED=['common.php','data/dbconfig.php','bbs/login.php','bbs/login_check.php','bbs/board.php','noa-music.php','noa-world.php','noa-hero.js','noa-app/engine/n80.php','noa-app/jukebox/stream.php','noa-app/jukebox/download.php','noa-app/editorial-content.php']
release.BACKUP=Path(os.environ.get('RUNNER_TEMP','/tmp'))/'noa-starlight-before.json'

def verify():
 for path in ['/','/noa-about.php','/noa-privacy.php','/noa-terms.php','/bbs/login.php','/noa-sitemap.php']:
  with urllib.request.urlopen('https://noastudio.ai.kr'+path,timeout=30) as response:
   html=response.read().decode('utf-8')
   if response.status!=200 or '/noa-starlight.css?v=' not in html or 'data-noa-style="starlight"' not in html or 'Fatal error' in html:raise RuntimeError('starlight_route_failed:'+path)
 with urllib.request.urlopen('https://noastudio.ai.kr/noa-design.json',timeout=30) as response:
  design=json.load(response)
  if [t['id'] for t in design['themes']]!=['noa-studio']:raise RuntimeError('single_palette_failed')
 with urllib.request.urlopen('https://noastudio.ai.kr/noa-bridge/ui-preferences.php',timeout=30) as response:
  prefs=json.load(response)
  if prefs['defaults']!={'theme':'noa-studio','enabled':['noa-studio']}:raise RuntimeError('preference_migration_failed')
 with urllib.request.urlopen('https://noastudio.ai.kr/noa-home.js',timeout=30) as response:
  if 'function listSize(state)' not in response.read().decode('utf-8'):raise RuntimeError('viewport_rows_script_missing')
 for path,source in release.FILES.items():
  if path.endswith('.webp'):
   with urllib.request.urlopen('https://noastudio.ai.kr/'+path,timeout=30) as response:
    if release.sha(response.read())!=release.sha(Path(source).read_bytes()):raise RuntimeError('artwork_hash_mismatch:'+path)
 print('STARLIGHT_PUBLIC_ROUTES_AND_DARK_PREFERENCES_VERIFIED')

if __name__=='__main__':
 if 'rollback' in sys.argv:release.main()
 else:
  try:release.main();verify()
  except Exception:
   if release.BACKUP.exists():
    sys.argv.append('rollback');release.main()
   raise
