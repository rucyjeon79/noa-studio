"""Publish the verified public, member, writing and administration theme surfaces."""
import os
import sys
from pathlib import Path
import noa_ainoa_deploy as release
from noa_release_freshness import BUSAN_ONLY_PATH_PREFIXES

# Busan has a separate host. Any NOA source, dependency or verification change still requires a new candidate.
release.UNRELATED_PATH_PREFIXES = BUSAN_ONLY_PATH_PREFIXES

theme_assets = {'noa-assets/theme-' + p.name: str(p) for p in sorted(Path('public/noa-theme-scenes').glob('*.webp'))}
release.FILES = {**theme_assets, 'noa-bridge/ui-preferences.php': 'bridge/ui-preferences.php', **{name: 'deploy/' + name for name in ('noa-starlight.css', 'noa-design.json', 'noa-ui.js', 'noa-home.js', 'noa-desktop.js', 'noa-theme-admin.php', 'noa-vip.php', 'noa-app/home.php')}}
release.FILES.update({name:'deploy/'+name for name in ('noa-ecosystem.css','noa-admin.css','noa-gnuboard.css','noa-member-badges.css','noa-support.css','noa-gifts.css')})
release.FILES['extend/noa.design.php'] = 'deploy/noa-design.extend.php'
release.FILES.update({name: 'deploy/' + name for name in ('noa-account.js', 'noa-youngcart-premium.css', 'noa-voice.js', 'noa-ainoa.css', 'noa-amt-fan.js', 'noa-amt-fan.css', 'noa-sitemap.php')})
release.FILES = {'noa-interface-labels.json':'deploy/noa-interface-labels.json','noa-bridge/weather.php':'bridge/weather.php', **release.FILES}
release.FILES.update({'noa-youngcart.php':'deploy/noa-youngcart.php','extend/zz.noa-youngcart.php':'deploy/noa-youngcart.extend.php'})
release.FILES.update({name:'deploy/'+name for name in ('noa-hero.js','noa-listening-model.js','noa-listening.js','noa-listening.css','noa-music.php','noa-music-vinyl.css')})
release.FILES.update({'noa-bridge/listening.php':'bridge/listening.php','noa-bridge/home.php':'bridge/home.php','noa-bridge/home-core.php':'bridge/home-core.php'})
# These two items are owned and checked byte-for-byte by this coordinated release.
release.PROTECTED = [name for name in release.PROTECTED if name not in ('noa-hero.js','noa-music.php')]
release.NEW = set(theme_assets) | {'noa-bridge/weather.php','noa-interface-labels.json'}
release.BACKUP = Path(os.environ.get('RUNNER_TEMP', '/tmp')) / 'noa-light-theme-before.json'

# A form and palette release owns only its presentation files, including rollback.
if os.environ.get('NOA_SURFACE_POLISH') == 'true':
    surface_files = ('noa-starlight.css','noa-ui.js','noa-admin.css','noa-ecosystem.css',
                     'noa-gnuboard.css','noa-member-badges.css','noa-support.css','noa-gifts.css','extend/noa.design.php')
    release.FILES = {name:release.FILES[name] for name in surface_files}
    release.NEW = set()
    release.PROTECTED = [*release.PROTECTED,'noa-hero.js','noa-music.php']

if os.environ.get('NOA_MENU_DRAWER') == 'true':
    release.FILES = {name:'deploy/'+name for name in ('noa-login.php','noa-sitemap.php','noa-starlight.css','noa-account.js','noa-ui.js')}
    release.FILES['noa-assets/drawer-studio-session.jpg'] = 'public/drawer/studio-session.jpg'
    release.NEW = {'noa-assets/drawer-studio-session.jpg'}
    release.PROTECTED = list(dict.fromkeys([*release.PROTECTED,'noa-hero.js','noa-music.php']))

if os.environ.get('NOA_PANORAMA') == 'true':
    names = ('noa-page-progress.js','noa-app/engine/personal-listening.php','noa-listening-model.js',
             'noa-music.php','noa-listening.js','noa-interface-labels.json','noa-starlight.css','noa-ui.js')
    release.FILES = {name:'deploy/'+name for name in names}
    release.FILES['extend/noa.design.php'] = 'deploy/noa-design.extend.php'
    release.NEW = {'noa-page-progress.js'}
    release.PROTECTED = [name for name in release.PROTECTED if name != 'noa-music.php']

if os.environ.get('NOA_THEME_CLOCK') == 'true':
    clock_files = ('noa-design.json','extend/noa.design.php','noa-ui.js','noa-theme-admin.php','noa-interface-labels.json')
    release.FILES = {name:release.FILES[name] for name in clock_files}
    release.NEW = set()
    release.PROTECTED = list(dict.fromkeys([*release.PROTECTED,'noa-hero.js','noa-music.php']))

if __name__ == '__main__':
    try:
        release.main()
    except Exception:
        if 'rollback' not in sys.argv and release.BACKUP.exists():
            sys.argv.append('rollback')
            release.main()
        raise
