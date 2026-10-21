<?php
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
return [
'noa_popularity_settings'=>"(id INT PRIMARY KEY,policy JSON NOT NULL,revision INT NOT NULL DEFAULT 1,updated_by VARCHAR(191) NOT NULL,updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)",
'noa_play_sessions'=>"(token CHAR(64) PRIMARY KEY,actor CHAR(64) NOT NULL,song_id VARCHAR(191) NOT NULL,song_key VARCHAR(191) NOT NULL,created_at BIGINT NOT NULL,started_at BIGINT NULL,last_at BIGINT NULL,last_position DOUBLE NOT NULL DEFAULT 0,credited DOUBLE NOT NULL DEFAULT 0,status VARCHAR(32) NOT NULL,reason VARCHAR(64) NULL,policy JSON NOT NULL,KEY(actor,song_id,created_at),KEY(status,created_at))",
'noa_valid_plays'=>"(token CHAR(64) PRIMARY KEY,actor CHAR(64) NOT NULL,song_id VARCHAR(191) NOT NULL,accepted_at BIGINT NOT NULL,seconds_played DOUBLE NOT NULL,KEY(song_id,accepted_at),KEY(actor,song_id,accepted_at))",
'noa_ranking_runs'=>"(hour_utc DATETIME PRIMARY KEY,status VARCHAR(16) NOT NULL,collection_id VARCHAR(64) NOT NULL,youtube_synced_at VARCHAR(64) NOT NULL,rules_version VARCHAR(64) NOT NULL,policy_revision INT NOT NULL,summary JSON NOT NULL,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)",
'noa_ranking_rows'=>"(hour_utc DATETIME NOT NULL,rank_type VARCHAR(32) NOT NULL,group_id VARCHAR(64) NOT NULL,content_id VARCHAR(191) NOT NULL,youtube_views BIGINT UNSIGNED NOT NULL,jukebox_plays BIGINT UNSIGNED NOT NULL,score BIGINT UNSIGNED NOT NULL,current_rank INT NOT NULL,previous_rank INT NULL,rank_delta INT NULL,rank_state VARCHAR(16) NOT NULL,payload JSON NOT NULL,PRIMARY KEY(hour_utc,rank_type,group_id,content_id),UNIQUE KEY(hour_utc,rank_type,group_id,current_rank))",
'noa_ranking_errors'=>"(id BIGINT AUTO_INCREMENT PRIMARY KEY,kind VARCHAR(32) NOT NULL,code VARCHAR(64) NOT NULL,hour_utc DATETIME NULL,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,KEY(kind,created_at))"
];
