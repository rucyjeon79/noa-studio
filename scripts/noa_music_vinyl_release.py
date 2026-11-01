"""Publish only the home collection renderer and its stylesheet."""
import noa_ainoa_deploy as release
release.FILES={'noa-music-vinyl.css':'deploy/noa-music-vinyl.css','noa-music-vinyl.js':'deploy/noa-music-vinyl.js','extend/zz.noa-music-vinyl.php':'deploy/noa-music-vinyl.extend.php'}
release.FILES['noa-support.js']='deploy/noa-support.js'
release.FILES['noa-engagement.js']='deploy/noa-engagement.js'
release.FILES['noa-playcount.js']='deploy/noa-playcount.js'
release.FILES['noa-bridge/support.php']='bridge/support.php'
release.FILES['noa-ui.js']='deploy/noa-ui.js'
release.NEW=set(release.FILES)
if __name__=='__main__':
    import sys
    try:release.main()
    except Exception:
        if 'rollback' not in sys.argv and release.BACKUP.exists():
            sys.argv.append('rollback');release.main()
        raise
