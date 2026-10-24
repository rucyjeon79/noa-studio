<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/app-data.php';
$dsn=getenv('NOA_TEST_MYSQL_DSN');
if(!$dsn||!str_contains($dsn,'host=127.0.0.1;')||!str_contains($dsn,'dbname=noa_catalog_test;'))throw new RuntimeException('isolated_mysql_required');
$db=new PDO($dsn,'root','noa-test-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
$db->exec('CREATE DATABASE IF NOT EXISTS n80_app_data_test');$db->exec('USE n80_app_data_test');
$db->exec("SET SESSION sql_mode='STRICT_ALL_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE'");
$db->exec('CREATE TABLE noa_ranking_runs(hour_utc DATETIME PRIMARY KEY,status VARCHAR(16))');
$db->exec('CREATE TABLE noa_ranking_rows(hour_utc DATETIME)');
$db->exec("INSERT INTO noa_ranking_runs VALUES('2026-10-24 01:00:00','published')");
$db->exec("INSERT INTO noa_ranking_rows VALUES('2026-10-24 01:00:00'),('2026-10-24 02:00:00')");
$db->exec('SET TRANSACTION READ ONLY');$db->beginTransaction();
try{$r=n80_app_audit($db,'unused','g5_member');if($r['checks']['ranking_run']['orphanRows']!==1)exit(1);$db->commit();}
catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
if((int)$db->query('SELECT COUNT(*) FROM noa_ranking_rows')->fetchColumn()!==2)exit(2);
echo "N80_MYSQL_DATETIME_RELATION_READ_ONLY_OK\n";
