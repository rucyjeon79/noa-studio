"""Install the login presentation; native authentication and provider settings stay intact."""
import noa_ainoa_deploy as release

release.FILES = {
    'noa-assets/google-login-g.png': 'deploy/noa-assets/google-login-g.png',
    'noa-login.css': 'deploy/noa-login.css',
    'noa-login.php': 'deploy/noa-login.php',
}
release.NEW = {'noa-assets/google-login-g.png', 'noa-login.css'}
release.PROTECTED += ['extend/zz.noa-social.php', 'noa-bridge/social-policy.php',
                      'plugin/social/register_member.php', 'plugin/social/register_member_update.php']

if __name__ == '__main__':
    release.main()
