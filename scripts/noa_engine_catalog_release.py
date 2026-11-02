import noa_ainoa_deploy as release
release.FILES={'noa-bridge/package-record.php':'bridge/package-record.php','noa-bridge/inline-edit.php':'bridge/inline-edit.php','noa-sitemap.php':'deploy/noa-sitemap.php','noa-workspace.php':'deploy/noa-workspace.php'}
release.NEW=set()
release.PROTECTED=[path for path in release.PROTECTED if path not in release.FILES]
if __name__=='__main__': release.main()
