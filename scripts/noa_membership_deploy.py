"""Use the existing guarded transport; activate the early policy hook last."""
import noa_ainoa_deploy as release
release.FILES={
 'noa-bridge/membership-core.php':'bridge/membership-core.php',
 'noa-bridge/social-policy.php':'bridge/social-policy.php',
 'noa-bridge/membership.php':'bridge/membership.php',
 'noa-account.css':'deploy/noa-account.css','noa-account.js':'deploy/noa-account.js',
 'noa-membership.js':'deploy/noa-membership.js','noa-membership.php':'deploy/noa-membership.php',
 'noa-login.php':'deploy/noa-login.php','noa-sitemap.php':'deploy/noa-sitemap.php',
 'extend/zz.noa-social.php':'deploy/noa-social.extend.php',
 'extend/noa.00-membership.php':'deploy/noa-membership.extend.php',
}
release.NEW=set(release.FILES)-{'noa-sitemap.php'}
if __name__=='__main__':
    release.main()
    if 'rollback' not in release.sys.argv:
        from pathlib import Path
        import shutil
        Path('membership-proof').mkdir(exist_ok=True)
        shutil.copy('ainoa-proof/deployment.json','membership-proof/deployment.json')
