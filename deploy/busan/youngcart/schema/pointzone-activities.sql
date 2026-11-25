-- POINT ZONE feature data only. No member or point ledger schema changes.
-- CREATE-only; initially empty. No sample products/campaigns in production.
CREATE TABLE bpz_activity (
 id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 kind ENUM('auction','sharing','events','profile') NOT NULL,
 title VARCHAR(100) NOT NULL,
 description TEXT NOT NULL,
 state ENUM('draft','open','closed','cancelled') NOT NULL DEFAULT 'draft',
 opens_at DATETIME NOT NULL,
 closes_at DATETIME NULL,
 point_amount INT UNSIGNED NOT NULL DEFAULT 0,
 step_points INT UNSIGNED NOT NULL DEFAULT 0,
 capacity INT UNSIGNED NOT NULL DEFAULT 0,
 duration_days INT UNSIGNED NOT NULL DEFAULT 0,
 item_id VARCHAR(20) NULL,
 created_at DATETIME NOT NULL,
 KEY kind_state (kind,state,opens_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE bpz_participation (
 id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 activity_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 mb_id VARCHAR(20) NOT NULL,
 request_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 amount INT UNSIGNED NOT NULL DEFAULT 0,
 state ENUM('submitted','pending','confirmed','rejected','awarded','cancelled') NOT NULL,
 native_point_id BIGINT UNSIGNED NULL,
 created_at DATETIME NOT NULL,
 UNIQUE KEY member_request (mb_id,request_id),
 KEY activity_state (activity_id,state,created_at),
 KEY member_history (mb_id,created_at),
 CONSTRAINT bpz_participation_activity FOREIGN KEY(activity_id) REFERENCES bpz_activity(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE bpz_entitlement (
 id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 activity_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 mb_id VARCHAR(20) NOT NULL,
 order_id VARCHAR(15) NOT NULL,
 starts_at DATETIME NOT NULL,
 expires_at DATETIME NULL,
 revoked_at DATETIME NULL,
 UNIQUE KEY order_activity (order_id,activity_id),
 KEY member_entitlements (mb_id,expires_at),
 CONSTRAINT bpz_entitlement_activity FOREIGN KEY(activity_id) REFERENCES bpz_activity(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
