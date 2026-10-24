<?php
declare(strict_types=1);
define('_GNUBOARD_', true);
require __DIR__.'/../../deploy/noa-app/database/core.php';
$db=new class extends PDO { public function __construct() {} };
$before=glob(sys_get_temp_dir().'/noa-db-private/*')?:[];
try { nd_backup($db,null);throw new RuntimeException('host_sql_backup_was_not_blocked'); }
catch(DomainException $e){if(!str_contains($e->getMessage(),'Google Drive'))throw $e;}
if((glob(sys_get_temp_dir().'/noa-db-private/*')?:[])!==$before)throw new RuntimeException('backup_files_created');
echo "DRIVE_ONLY_SQL_POLICY_VERIFIED: missing provider blocks before filesystem or DB access\n";
