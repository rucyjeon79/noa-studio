"""Publish only the engagement browser error-handling fix, with existing guards."""
import sys
sys.path.insert(0,'scripts')
import noa_ainoa_deploy as release
release.FILES={'noa-engagement.js':'deploy/noa-engagement.js'}
release.NEW=set()
release.main()
