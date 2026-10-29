"""Scoped read-path responsiveness and AInoa guidance release."""
import noa_ainoa_deploy as release
release.FILES={'noa-home.js':'deploy/noa-home.js','noa-hero.js':'deploy/noa-hero.js','noa-bridge/membership.php':'bridge/membership.php','noa-bridge/ainoa-core.php':'bridge/ainoa-core.php','noa-ainoa.php':'deploy/noa-ainoa.php','noa-account.js':'deploy/noa-account.js','noa-ainoa.js':'deploy/noa-ainoa.js','noa-voice.js':'deploy/noa-voice.js'}
release.PROTECTED=[p for p in release.PROTECTED if p not in release.FILES]
release.NEW=set()
if __name__=='__main__':release.main()
