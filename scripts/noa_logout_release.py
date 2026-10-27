"""Preserve native logout/session logic; deploy only the isolated asset-injection scope."""
import noa_ainoa_deploy as release
release.FILES={'extend/noa.00-membership.php':'deploy/noa-membership.extend.php'}
release.NEW=set()
release.PROTECTED+=['bbs/logout.php','noa-my.php','noa-account.js','noa-account.css','extend/zz.noa-social.php','noa-bridge/member-access.php','noa-android-release.json']
if __name__=='__main__':
    release.main()
    if 'rollback' not in release.sys.argv:
        from pathlib import Path
        import shutil
        Path('logout-proof').mkdir(exist_ok=True)
        shutil.copy('ainoa-proof/deployment.json','logout-proof/deployment.json')
