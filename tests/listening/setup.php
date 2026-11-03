<?php
define('_GNUBOARD_',true);require dirname(__DIR__,2).'/bridge/storage.php';$db=noa_bridge_pdo();
$db->exec("CREATE TABLE noa_documents (doc_key VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY, kind VARCHAR(32) NOT NULL,payload JSON NOT NULL,revision INT NOT NULL DEFAULT 0,updated_by VARCHAR(255),updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB");
$db->exec('CREATE TABLE noa_user_playlists (owner_id VARCHAR(64),playlist_id VARCHAR(40),title VARCHAR(160),tracks JSON,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
$db->exec('CREATE TABLE noa_play_sessions (token CHAR(64) PRIMARY KEY,song_key VARCHAR(191))');$db->exec('CREATE TABLE noa_valid_plays (token CHAR(64) PRIMARY KEY)');
$db->exec("INSERT INTO noa_user_playlists(owner_id,playlist_id,title,tracks) VALUES ('alice','one','내 음악','[\"single:kpop-original:01\"]'),('bob','two','다른 회원','[\"single:jpop-original:01\"]')");
