"""Publish only the home collection renderer and its stylesheet."""
import noa_ainoa_deploy as release
release.FILES={'noa-amt-fan.js':'deploy/noa-amt-fan.js','noa-amt-fan.css':'deploy/noa-amt-fan.css','extend/zz.noa-amt-fan.php':'deploy/noa-amt-fan.extend.php'}
release.NEW=set(release.FILES)
if __name__=='__main__':
    import sys
    try:release.main()
    except Exception:
        if 'rollback' not in sys.argv and release.BACKUP.exists():
            sys.argv.append('rollback');release.main()
        raise
