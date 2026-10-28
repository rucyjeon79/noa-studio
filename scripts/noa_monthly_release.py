"""Scoped monthly rewards and completed-master layout; source preimages and native balances protected."""
import noa_ainoa_deploy as release
release.FILES={
 'noa-bridge/monthly-rewards.php':'bridge/monthly-rewards.php',
 'noa-bridge/membership-core.php':'bridge/membership-core.php',
 'noa-bridge/engagement.php':'bridge/engagement.php',
 'noa-app/monthly-banner.php':'deploy/noa-app/monthly-banner.php',
 'noa-app/home.php':'deploy/noa-app/home.php',
 'noa-membership.php':'deploy/noa-membership.php',
 'noa-premium.js':'deploy/noa-premium.js',
 'noa-engagement.css':'deploy/noa-engagement.css',
 'noa-creator.js':'deploy/noa-creator.js',
 'extend/noa.00-membership.php':'deploy/noa-membership.extend.php',
}
release.NEW={'noa-bridge/monthly-rewards.php','noa-app/monthly-banner.php'}
release.PROTECTED=[p for p in release.PROTECTED if p not in release.FILES]+['noa-bridge/subscription-core.php','noa-bridge/music-download-core.php','noa-bridge/engagement-core.php','noa-app/jukebox/core.php','noa-app/jukebox/upload-core.php','noa-app/jukebox/queue-core.php','noa-bridge/notifications-core.php']
if __name__=='__main__':release.main()
