"""Deploy only the shared vertical overscroll policy, preserving all application data."""
import noa_ainoa_deploy as release
release.FILES={'noa-ui.css':'deploy/noa-ui.css'}
release.NEW=set()
if __name__=='__main__':release.main()
