"""Publish only the home collection renderer and its stylesheet."""
import noa_ainoa_deploy as release
release.FILES={name:'deploy/'+name for name in ('noa-starlight.css','noa-home.js')}
release.NEW=set()
if __name__=='__main__':
    import sys
    try:release.main()
    except Exception:
        if 'rollback' not in sys.argv and release.BACKUP.exists():
            sys.argv.append('rollback');release.main()
        raise
