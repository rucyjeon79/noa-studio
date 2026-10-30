"""One-file account recovery release; preserve the rest of the application."""
import noa_ainoa_deploy as release
release.FILES={'noa-account.js':'deploy/noa-account.js'}
release.NEW=set()
if __name__=='__main__':release.main()
