"""Release the gift purchase, redemption and expiry notification paths together."""
import noa_ainoa_deploy as release

release.FILES = {
    **{'noa-bridge/'+name: 'bridge/'+name for name in (
        'gift-core.php', 'toss-core.php', 'notifications-core.php', 'notifications-sources.php')},
    **{name: 'deploy/'+name for name in (
        'noa-membership-wallet.css', 'noa-membership.php', 'noa-gifts.css', 'noa-gifts.php', 'noa-points.js', 'noa-vip.php', 'noa-my.php', 'noa-sitemap.php')}
}
release.NEW = {'noa-membership-wallet.css','noa-bridge/gift-core.php','noa-gifts.css','noa-gifts.php'}
if __name__ == '__main__':
    release.main()
