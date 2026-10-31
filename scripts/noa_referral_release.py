"""Additive invitation UI and exactly-once signup credits; no core/member migration."""
import sys
import noa_ainoa_deploy as release
release.FILES={
 'noa-bridge/referral-core.php':'bridge/referral-core.php',
 'noa-bridge/referral.php':'bridge/referral.php',
 'noa-referral.css':'deploy/noa-referral.css',
 'noa-referral.js':'deploy/noa-referral.js',
 'extend/zz.noa-referral.php':'deploy/noa-referral.extend.php',
 'noa-bridge/creator-enrollment-core.php':'bridge/creator-enrollment-core.php',
}
release.NEW=set(release.FILES)-{'noa-bridge/creator-enrollment-core.php'}
release.PROTECTED+=['plugin/social/register_member_update.php','noa-bridge/subscription-core.php','noa-bridge/membership-core.php']
if __name__=='__main__':
 try:release.main()
 except Exception:
  if 'rollback' not in sys.argv and release.BACKUP.exists():
   sys.argv.append('rollback');release.main()
  raise
