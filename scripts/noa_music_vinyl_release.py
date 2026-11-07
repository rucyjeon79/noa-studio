"""Publish the music catalog presentation and its reviewed dependencies."""
import os
from noa_release_freshness import BUSAN_ONLY_PATH_PREFIXES
import noa_ainoa_deploy as release
release.FILES={'noa-music-vinyl.css':'deploy/noa-music-vinyl.css','noa-music-vinyl.js':'deploy/noa-music-vinyl.js','extend/zz.noa-music-vinyl.php':'deploy/noa-music-vinyl.extend.php'}
release.FILES['noa-support.js']='deploy/noa-support.js'
release.FILES['noa-engagement.js']='deploy/noa-engagement.js'
release.FILES['noa-playcount.js']='deploy/noa-playcount.js'
release.FILES['noa-bridge/support.php']='bridge/support.php'
release.FILES['noa-ui.js']='deploy/noa-ui.js'
release.FILES['noa-ui.css']='deploy/noa-ui.css'
release.FILES['noa-browse.js']='deploy/noa-browse.js'
release.FILES['noa-browse-edit.js']='deploy/noa-browse-edit.js'
release.NEW=set(release.FILES)
if os.environ.get('NOA_TRACK_FOLLOW') == 'true':
    release.FILES = {name:'deploy/'+name for name in ('noa-music.php','noa-browse.js','noa-music-vinyl.js')}
    release.NEW = set()
    release.PROTECTED = [name for name in release.PROTECTED if name != 'noa-music.php']
    release.UNRELATED_PATH_PREFIXES = BUSAN_ONLY_PATH_PREFIXES
if os.environ.get('NOA_FIXED_CATALOG') == 'true':
    release.FILES = {name: 'deploy/' + name for name in (
        'noa-music-vinyl.css', 'noa-music-vinyl.js', 'noa-browse.js', 'noa-youtube.css',
    )}
    release.NEW = set()
    release.UNRELATED_PATH_PREFIXES = BUSAN_ONLY_PATH_PREFIXES
if __name__=='__main__':
    import sys
    try:release.main()
    except Exception:
        if 'rollback' not in sys.argv and release.BACKUP.exists():
            sys.argv.append('rollback');release.main()
        raise
