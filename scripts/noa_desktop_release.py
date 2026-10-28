"""Desktop companion source-only activation, with exact preimage guards and rollback."""
import noa_ainoa_deploy as release
release.FILES={p:'deploy/'+p for p in ['noa-desktop.css','noa-desktop.js','noa-account.js','noa-notifications.js','noa-ainoa-admin.js','noa-ainoa.js']}
release.FILES['extend/noa.design.php']='deploy/noa-design.extend.php'
release.NEW={'noa-desktop.css','noa-desktop.js'}
release.PROTECTED=[p for p in release.PROTECTED if p not in release.FILES]
if __name__=='__main__':release.main()
