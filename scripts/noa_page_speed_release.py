import noa_ainoa_deploy as release
release.FILES={'noa-bridge/notifications.php':'bridge/notifications.php','noa-notifications.js':'deploy/noa-notifications.js','noa-ui.js':'deploy/noa-ui.js'}
release.NEW=set()
release.PROTECTED=[path for path in release.PROTECTED if path not in release.FILES]
if __name__=='__main__': release.main()
