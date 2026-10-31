import noa_ainoa_deploy as release
release.FILES={'extend/noa.design.php':'deploy/noa-design.extend.php','noa-app/home.php':'deploy/noa-app/home.php'}
release.NEW=set()
if __name__=='__main__': release.main()
