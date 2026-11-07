"""Shared explorer sources must be active before the desks that call them."""
DEPENDENCIES = {
    path: 'deploy/' + path for path in (
        'noa-app/engine/explorer.php', 'noa-explorer.css', 'noa-channel-explorer.js',
    )
}
