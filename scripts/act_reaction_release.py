import noa_ainoa_deploy as release
release.FILES={'noa-bridge/engagement-targets.php':'bridge/engagement-targets.php'}
release.NEW=set(release.FILES)
if __name__=='__main__':
    import sys
    try: release.main()
    except Exception:
        if release.BACKUP.exists():
            sys.argv.append('rollback');release.main()
        raise
