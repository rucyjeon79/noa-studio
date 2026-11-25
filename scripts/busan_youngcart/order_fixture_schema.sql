-- ISOLATED TEST DATABASE ONLY. Not a production migration.
-- The existing GnuBoard point ledger remains the sole production ledger.
CREATE TABLE bpz_fixture_member (
  mb_id VARCHAR(255) NOT NULL PRIMARY KEY,
  balance INT NOT NULL CHECK (balance >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE bpz_fixture_request (
  request_id CHAR(32) CHARACTER SET ascii NOT NULL PRIMARY KEY,
  receipt LONGTEXT NULL
) ENGINE=InnoDB;
CREATE TABLE bpz_fixture_order (
  order_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  member_id VARCHAR(255) NOT NULL,
  request_id CHAR(32) CHARACTER SET ascii NOT NULL UNIQUE,
  debit_points INT NOT NULL CHECK (debit_points > 0),
  receipt LONGTEXT NOT NULL,
  cancellation LONGTEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE bpz_fixture_ledger (
  order_id BIGINT UNSIGNED NOT NULL,
  kind ENUM('debit','reversal') NOT NULL,
  member_id VARCHAR(255) NOT NULL,
  delta INT NOT NULL,
  PRIMARY KEY (order_id,kind),
  CHECK ((kind='debit' AND delta<0) OR (kind='reversal' AND delta>0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
