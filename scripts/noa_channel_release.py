"""Scoped channel repair, preserving existing document keys and media files."""
import noa_ainoa_deploy as release
release.FILES={
 'noa-bridge/channel-ownership.php':'bridge/channel-ownership.php',
 'noa-bridge/package-record.php':'bridge/package-record.php',
 'noa-bridge/creator-core.php':'bridge/creator-core.php',
 'noa-bridge/creator.php':'bridge/creator.php',
 'noa-bridge/index.php':'bridge/index.php',
 'noa-channel.php':'deploy/noa-channel.php',
 'noa-creator.js':'deploy/noa-creator.js',
 'noa-creator.php':'deploy/noa-creator.php',
}
release.NEW={'noa-bridge/channel-ownership.php'}
if __name__=='__main__':release.main()
