"""Creator enrollment: dependency-first source activation with exact preimage guards."""
import noa_ainoa_deploy as release
release.FILES={}
for p in ['member-access.php','member-badges.php','creator-enrollment-core.php','creator-ai-core.php','creator-enrollment.php','creator-ai.php','community-core.php','engagement-targets.php']:
 release.FILES['noa-bridge/'+p]='bridge/'+p
for p in ['noa-member-badges.css','noa-member-badges.js','noa-creator-apply.css','noa-creator-apply.js','noa-creator-ai.js','noa-channel-menu.php','noa-creator-symbol.php','noa-creator-apply.php','noa-creator-review.php','noa-creator-ai.php','noa-channel-workspace.php','noa-my.php','noa-workspace.php','noa-library.php','noa-login.php','noa-channel.php','noa-creator.js','noa-community.js','noa-engagement.js']:
 release.FILES[p]='deploy/'+p
release.FILES['theme/noa_studio/skin-bridge.php']='deploy/theme/noa_studio/skin-bridge.php'
release.FILES['extend/noa.creator-membership.php']='deploy/noa-creator-membership.extend.php'
release.FILES['extend/noa.social.php']='deploy/noa-social.extend.php'
release.NEW={p for p in release.FILES if p in ['noa-bridge/member-badges.php','noa-bridge/creator-enrollment-core.php','noa-bridge/creator-ai-core.php','noa-bridge/creator-enrollment.php','noa-bridge/creator-ai.php','extend/noa.creator-membership.php'] or p.startswith(('noa-member-badges.','noa-creator-apply.','noa-creator-ai.','noa-channel-menu.','noa-creator-symbol.','noa-creator-review.','noa-channel-workspace.'))}
if __name__=='__main__':release.main()
