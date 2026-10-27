"""AInoa speech and discoverable locked menus; read-only account presentation."""
import noa_ainoa_deploy as release
release.FILES={
 'noa-voice-state.php':'deploy/noa-voice-state.php',
 'noa-voice.js':'deploy/noa-voice.js',
 **{p:'deploy/'+p for p in ['noa-ainoa.php','noa-ainoa.js','noa-ainoa.css','noa-ui.js','noa-notifications.js','noa-sitemap.php']},
 'noa-bridge/member-access.php':'bridge/member-access.php',
 'extend/noa.design.php':'deploy/noa-design.extend.php',
}
release.NEW={'noa-voice-state.php','noa-voice.js'}
release.PROTECTED+=['bbs/write_comment_update.php','bbs/delete_comment.php','bbs/good.php','noa-bridge/notifications-inline.php','noa-bridge/notifications-core.php','noa-bridge/popularity-core.php']
if __name__=='__main__':release.main()
