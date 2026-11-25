-- Candidate metadata schema. NOT an approved production migration.
-- No separate member balance or point ledger.
-- Run in isolated fixture until production backup and shared writer audit are verified.
CREATE TABLE bpz_order_request (
  request_id CHAR(32) CHARACTER SET ascii NOT NULL PRIMARY KEY,
  receipt LONGTEXT NULL
) ENGINE=InnoDB;
CREATE TABLE bpz_order_receipt (
  order_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  member_id VARCHAR(255) NOT NULL,
  request_id CHAR(32) CHARACTER SET ascii NOT NULL UNIQUE,
  debit_points INT NOT NULL CHECK (debit_points > 0),
  receipt LONGTEXT NOT NULL,
  cancellation LONGTEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
