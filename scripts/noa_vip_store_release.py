import noa_ainoa_deploy as release
release.FILES={'noa-bridge/subscription-core.php':'bridge/subscription-core.php','noa-bridge/vip-store-core.php':'bridge/vip-store-core.php','noa-bridge/vip-store.php':'bridge/vip-store.php','noa-vip.css':'deploy/noa-vip.css','noa-vip.js':'deploy/noa-vip.js'}
release.FILES.update({'noa-assets/vip-'+p+'.webp':'deploy/noa-assets/vip-'+p+'.webp' for p in ['vip30','vip365','creator30','creator365']})
release.FILES.update({'noa-vip.php':'deploy/noa-vip.php','noa-points.php':'deploy/noa-points.php','noa-membership.php':'deploy/noa-membership.php'})
release.NEW=set(release.FILES)-{'noa-bridge/subscription-core.php','noa-points.php','noa-membership.php'}
if __name__=='__main__':release.main()
