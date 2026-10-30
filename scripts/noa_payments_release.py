"""Deploy payment code only; never config, keys, policy activation or point mutations."""
import noa_ainoa_deploy as release
release.FILES={
 **{'noa-bridge/'+p:'bridge/'+p for p in ['toss-config.php','toss-core.php','toss.php','toss-webhook.php']},
 **{p:'deploy/'+p for p in ['noa-points.php','noa-points.js','noa-points.css','noa-engagement.css','noa-payment-settings.php','noa-membership.php','noa-sitemap.php','noa-workspace.php']},
}
release.FILES.update({'noa-assets/points-p'+str(p)+'.webp':'deploy/noa-assets/points/p'+str(p)+'.webp' for p in [1000,3000,5000,10000,30000,50000]})
release.NEW=set(release.FILES)-{'noa-engagement.css','noa-membership.php','noa-sitemap.php','noa-workspace.php'}
release.PROTECTED+=['noa-bridge/subscription-core.php','noa-bridge/membership-core.php','noa-bridge/music-download-core.php','noa-music-download.php','noa-bridge/engagement-core.php']
if __name__=='__main__':release.main()

