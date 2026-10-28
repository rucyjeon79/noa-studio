"""The native bootstrap does not load bridge storage before media endpoints."""
from pathlib import Path
p=Path('/tmp/noa-creator-site/common.php')
s=p.read_text()
old="require_once __DIR__.'/noa-bridge/storage.php';$fixtureDb=noa_bridge_pdo();"
new="$fixtureDb=new PDO(getenv('NOA_MYSQL_DSN'),getenv('NOA_MYSQL_USER'),getenv('NOA_MYSQL_PASSWORD'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);"
assert old in s
p.write_text(s.replace(old,new))
