"""Scoped KCP test-window release. No credentials, contract assertions or ledger changes."""
import noa_ainoa_deploy as release
release.FILES={'noa-bridge/kcp-test-core.php':'bridge/kcp-test-core.php','noa-kcp-test.php':'deploy/noa-kcp-test.php','noa-kcp-test.js':'deploy/noa-kcp-test.js','noa-payment-settings.php':'deploy/noa-payment-settings.php'}
release.NEW=set(release.FILES)-{'noa-payment-settings.php'}
release.PROTECTED+=['noa-bridge/toss-config.php','noa-bridge/toss-core.php','noa-bridge/toss.php','noa-points.php','noa-points.js','noa-bridge/subscription-core.php']
if __name__=='__main__':release.main()
