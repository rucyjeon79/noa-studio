-- Independent honor records only. Never modify native member/point tables.
CREATE TABLE IF NOT EXISTS bhof_round (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 period CHAR(7) NOT NULL,
 award_code VARCHAR(32) NOT NULL,
 state ENUM('review','vote','awarded','no_award','tie_review') NOT NULL DEFAULT 'review',
 review_until DATETIME NOT NULL,
 vote_until DATETIME NULL,
 winner_id VARCHAR(20) NULL,
 created_at DATETIME NOT NULL,
 PRIMARY KEY(id), UNIQUE KEY period_award(period,award_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS bhof_candidate (
 round_id BIGINT UNSIGNED NOT NULL, mb_id VARCHAR(20) NOT NULL,
 activity_score INT UNSIGNED NOT NULL, evidence_json TEXT NOT NULL,
 staff_passed TINYINT UNSIGNED NULL, finalist TINYINT UNSIGNED NOT NULL DEFAULT 0,
 PRIMARY KEY(round_id,mb_id),
 FOREIGN KEY(round_id) REFERENCES bhof_round(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS bhof_staff_elector (
 round_id BIGINT UNSIGNED NOT NULL, candidate_id VARCHAR(20) NOT NULL, voter_id VARCHAR(20) NOT NULL,
 PRIMARY KEY(round_id,candidate_id,voter_id),
 FOREIGN KEY(round_id,candidate_id) REFERENCES bhof_candidate(round_id,mb_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS bhof_staff_ballot (
 round_id BIGINT UNSIGNED NOT NULL, candidate_id VARCHAR(20) NOT NULL, voter_id VARCHAR(20) NOT NULL,
 approve TINYINT UNSIGNED NOT NULL, created_at DATETIME NOT NULL,
 PRIMARY KEY(round_id,candidate_id,voter_id),
 FOREIGN KEY(round_id,candidate_id,voter_id) REFERENCES bhof_staff_elector(round_id,candidate_id,voter_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS bhof_member_elector (
 round_id BIGINT UNSIGNED NOT NULL, voter_id VARCHAR(20) NOT NULL,
 PRIMARY KEY(round_id,voter_id), FOREIGN KEY(round_id) REFERENCES bhof_round(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS bhof_member_ballot (
 round_id BIGINT UNSIGNED NOT NULL, voter_id VARCHAR(20) NOT NULL,
 candidate_id VARCHAR(20) NOT NULL, created_at DATETIME NOT NULL,
 PRIMARY KEY(round_id,voter_id),
 FOREIGN KEY(round_id,voter_id) REFERENCES bhof_member_elector(round_id,voter_id),
 FOREIGN KEY(round_id,candidate_id) REFERENCES bhof_candidate(round_id,mb_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS bhof_award (
 round_id BIGINT UNSIGNED NOT NULL, mb_id VARCHAR(20) NOT NULL,
 awarded_at DATETIME NOT NULL, reward_state ENUM('pending','confirmed','review') NOT NULL DEFAULT 'pending',
 native_point_id BIGINT UNSIGNED NULL,
 PRIMARY KEY(round_id), UNIQUE KEY native_point_once(native_point_id),
 FOREIGN KEY(round_id,mb_id) REFERENCES bhof_candidate(round_id,mb_id),
 UNIQUE KEY round_owner(round_id,mb_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS bhof_profile_badge (
 mb_id VARCHAR(20) NOT NULL, award_round_id BIGINT UNSIGNED NOT NULL,
 PRIMARY KEY(mb_id),
 FOREIGN KEY(award_round_id,mb_id) REFERENCES bhof_award(round_id,mb_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
