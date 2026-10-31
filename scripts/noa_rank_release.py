import sys
import noa_ainoa_deploy as release

release.FILES={
    'noa-bridge/ainoa-points.php':'bridge/ainoa-points.php',
    'noa-bridge/community-music.php':'bridge/community-music.php',
    'noa-bridge/creator-enrollment-core.php':'bridge/creator-enrollment-core.php',
    'noa-bridge/ecosystem-core.php':'bridge/ecosystem-core.php',
    'noa-bridge/ecosystem-features.php':'bridge/ecosystem-features.php',
    'noa-bridge/ecosystem.php':'bridge/ecosystem.php',
    'noa-bridge/fan-membership.php':'bridge/fan-membership.php',
    'noa-bridge/member-access.php':'bridge/member-access.php',
    'noa-bridge/member-badges.php':'bridge/member-badges.php',
    'noa-bridge/membership-core.php':'bridge/membership-core.php',
    'noa-bridge/membership.php':'bridge/membership.php',
    'noa-bridge/subscription-access.php':'bridge/subscription-access.php',
    'noa-bridge/subscription-core.php':'bridge/subscription-core.php',
    'noa-bridge/subscription.php':'bridge/subscription.php',
    'noa-bridge/support-core.php':'bridge/support-core.php',
    'noa-bridge/vip-store-core.php':'bridge/vip-store-core.php',
    'noa-bridge/vip-store.php':'bridge/vip-store.php',
    'extend/noa.access.php':'deploy/noa-access.extend.php',
    'noa-app/ecosystem-view.php':'deploy/noa-app/ecosystem-view.php',
    'noa-channel-controls.js':'deploy/noa-channel-controls.js',
    'noa-channel-menu.php':'deploy/noa-channel-menu.php',
    'noa-channel-workspace.php':'deploy/noa-channel-workspace.php',
    'noa-creator-ai.js':'deploy/noa-creator-ai.js',
    'noa-creator-ai.php':'deploy/noa-creator-ai.php',
    'noa-creator-apply.js':'deploy/noa-creator-apply.js',
    'noa-creator-apply.php':'deploy/noa-creator-apply.php',
    'extend/noa.creator-membership.php':'deploy/noa-creator-membership.extend.php',
    'noa-creator-review.php':'deploy/noa-creator-review.php',
    'noa-login.php':'deploy/noa-login.php',
    'noa-membership.js':'deploy/noa-membership.js',
    'noa-membership.php':'deploy/noa-membership.php',
    'noa-sitemap.php':'deploy/noa-sitemap.php',
    'noa-subscription.js':'deploy/noa-subscription.js',
    'noa-vip.php':'deploy/noa-vip.php',
}
release.NEW={'noa-bridge/fan-membership.php'}
if __name__=='__main__':
    try:
        release.main()
    except Exception:
        if release.BACKUP.exists():
            sys.argv.append('rollback')
            release.main()
        raise
