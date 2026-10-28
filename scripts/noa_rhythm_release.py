"""Read-only home discovery and shared UI layout, with existing source preimage guards."""
import noa_ainoa_deploy as release
release.FILES={
 'noa-bridge/home-discovery.php':'bridge/home-discovery.php',
 'noa-bridge/home-core.php':'bridge/home-core.php',
 'noa-bridge/home.php':'bridge/home.php',
 **{p:'deploy/'+p for p in ['noa-home.js','noa-browse.js','noa-engagement.js','noa-ui.css','noa-engagement.css','noa-world.css','noa-account.css','noa-my.php']},
 'extend/noa.design.php':'deploy/noa-design.extend.php',
}
release.NEW={'noa-bridge/home-discovery.php'}
release.PROTECTED+=['noa-bridge/popularity-core.php','noa-bridge/popularity-store.php','noa-bridge/notifications-core.php','noa-bridge/engagement-core.php','noa-bridge/engagement.php','bbs/write_comment_update.php']
if __name__=='__main__':release.main()
