from pathlib import Path
import shutil
root=Path('/tmp/noa-db-http');root.mkdir(exist_ok=True);html=root/'html';html.mkdir(exist_ok=True)
shutil.copytree('deploy/noa-app/database',html/'noa-app/database',dirs_exist_ok=True)
(html/'common.php').write_text('''<?php
session_start();define('_GNUBOARD_',true);define('G5_PATH',__DIR__);
define('G5_MYSQL_HOST','127.0.0.1');define('G5_MYSQL_DB','noa_db_test');define('G5_MYSQL_USER','root');define('G5_MYSQL_PASSWORD','noa-test-only');
$is_member=isset($_COOKIE['test_role']);$is_admin=($_COOKIE['test_role']??'')==='super'?'super':'';$member=['mb_id'=>$_COOKIE['test_role']??''];$config=['cf_admin'=>'super'];$g5=['member_table'=>'members','config_table'=>'missing'];
''')
