"""Activity inbox, scoped menu links and existing creator profile corrections."""
import noa_ainoa_deploy as release
release.FILES={}
for p in ['engagement-targets.php','notifications-sources.php','notifications-core.php']:
 release.FILES['noa-bridge/'+p]='bridge/'+p
for p in ['noa-notifications.css','noa-notifications.js','noa-notifications.php','noa-engagement.js','noa-sitemap.php','noa-app/database/admin-link.js','noa-app/taxonomy/admin-link.js']:
 release.FILES[p]='deploy/'+p
release.FILES['extend/noa.database.php']='deploy/noa-database.extend.php'
release.FILES['extend/noa.taxonomy.php']='deploy/noa-taxonomy.extend.php'
release.NEW=set()
release.PROTECTED=[p for p in release.PROTECTED if p not in release.FILES]
if __name__=='__main__':release.main()
