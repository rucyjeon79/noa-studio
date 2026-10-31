"""Publish the screening room presentation with the existing catalog and player."""
import sys
import noa_ainoa_deploy as release
release.FILES={'noa-cinema.css':'deploy/noa-cinema.css','noa-cinema.js':'deploy/noa-cinema.js','noa-youtube.js':'deploy/noa-youtube.js','noa-browse.js':'deploy/noa-browse.js','extend/zz.noa-cinema.php':'deploy/noa-cinema.extend.php'}
release.NEW={'noa-cinema.js','noa-cinema.css','extend/zz.noa-cinema.php'}
if __name__=='__main__':
    try:release.main()
    except Exception:
        if 'rollback' not in sys.argv and release.BACKUP.exists():
            sys.argv.append('rollback');release.main()
        raise
