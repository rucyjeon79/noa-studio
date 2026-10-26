<?php
declare(strict_types=1);require __DIR__.'/../subscription/native_fixture.php';require __DIR__.'/../../scripts/noa_membership_storage.php';
if(!str_contains((string)getenv('NOA_MYSQL_DSN'),'dbname=noa_subscription_test;'))throw new RuntimeException('isolated_database_required');
ns_q('CREATE TABLE nr_storage_member(id INT PRIMARY KEY,value VARCHAR(100)) ENGINE=MyISAM');ns_q("INSERT INTO nr_storage_member VALUES(1,'member-data-retained')");
ns_q('CREATE TABLE nr_storage_point(id INT PRIMARY KEY,amount INT) ENGINE=MyISAM');ns_q('INSERT INTO nr_storage_point VALUES(1,130),(2,-30)');
ns_q('CREATE TABLE nr_storage_config(id INT PRIMARY KEY,login_points INT) ENGINE=MyISAM');ns_q('INSERT INTO nr_storage_config VALUES(1,100)');
$tables=['member_table'=>['name'=>'nr_storage_member','engine'=>'MyISAM'],'point_table'=>['name'=>'nr_storage_point','engine'=>'MyISAM'],'config_table'=>['name'=>'nr_storage_config','engine'=>'MyISAM']];
$before=[];foreach($tables as $k=>$t)$before[$k]=nrm_table_hash($t['name']);$backups=nrm_backup_convert($tables);
foreach($tables as $k=>$t){if(nrm_table_hash($t['name'])!==$before[$k]||nrm_table_hash($backups[$k]['backup'])!==$before[$k]||!$backups[$k]['restoreVerified'])throw new RuntimeException('backup_integrity');}
if(strtoupper(nrm_engine('nr_storage_member'))!=='INNODB'||strtoupper(nrm_engine('nr_storage_point'))!=='INNODB'||strtoupper(nrm_engine('nr_storage_config'))!=='MYISAM')throw new RuntimeException('storage_scope');
echo "MEMBERSHIP_SAME_HOST_BACKUP_RESTORE_ENGINE_CONVERSION_OK\n";
