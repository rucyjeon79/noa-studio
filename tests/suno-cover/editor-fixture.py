"""Substitute only the external provider in the isolated PHP/MySQL editor."""
import os
from pathlib import Path
root = Path(os.environ['RUNNER_TEMP']) / 'noa-inline-edit-fixture'
path = root/'noa-bridge/suno-cover.php'
stub = """
function nsc_fetch(string $url, bool $page, int $limit, float $deadline): array {
    if (str_contains($url, 'unavailable')) throw new RuntimeException('private');
    if ($page) return ['https://suno.com/song/12345678-1234-1234-1234-123456789abc',
        '<meta property="og:image" content="https://cdn2.suno.ai/'.basename($url).'.png">'];
    $im=imagecreatetruecolor(80,80);imagefill($im,0,0,imagecolorallocate($im,strlen($url),10,60));
    ob_start();imagepng($im);return [$url,ob_get_clean()];
}
"""
path.write_text(path.read_text().replace('function nsc_fetch(', stub+'\nfunction nsc_unused_transport('))
# Serve the fixture's verified bytes from the same authorized record as the editor.
(root/'fixture-cover.php').write_text("""<?php require 'common.php';require 'noa-bridge/storage.php';require 'noa-bridge/sound-core.php';require 'noa-bridge/suno-cover.php';
if(!$is_member){http_response_code(403);exit;}
$a=nj_find(noa_bridge_pdo(),$_GET['key']);if(!nj_verified($a,'cover')){http_response_code(404);exit;}
header('Content-Type: image/webp');readfile(nj_file($a['cover_path']));""")
