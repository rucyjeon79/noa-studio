"""Validate 부산지부ON's proposed point policy against a sanitized admin snapshot.

Offline / read-only by design: no network, DB connection, point writes, member PII.
A missing snapshot is not evidence of configured production amounts.
"""
import argparse
import json
from collections import defaultdict
from pathlib import Path

POLICY_PATH = Path(__file__).resolve().parents[1] / "config/busan-point-policy.json"
CONFIG_FIELDS = ("cf_use_point", "cf_register_point", "cf_login_point", "cf_point_term")
BOARD_FIELDS = ("bo_write_point", "bo_comment_point", "bo_read_point", "bo_download_point")
BOARD_TARGETS = {
    "write_created": "bo_write_point",
    "comment_created": "bo_comment_point",
    "read": "bo_read_point",
    "download": "bo_download_point",
}


def check_int(value, name):
    if type(value) is not int:
        raise ValueError("expected integer field: " + name)
    return value


def validate_policy(policy):
    if not isinstance(policy, dict) or policy.get("schema") != "busan-native-point-policy-v1":
        raise ValueError("unknown policy schema")
    if policy.get("site") != "skhnslu-busan.com" or policy.get("environment") != "busan-only":
        raise ValueError("incorrect environment")
    if policy.get("rollout") != "audit_only":
        raise ValueError("unsafe automatic apply mode")
    if policy.get("source") != "native_gnuboard" or policy.get("unit") != "P":
        raise ValueError("incorrect point ledger")
    safeguards = policy.get("safeguards")
    if not isinstance(safeguards, dict) or safeguards.get("preserve_existing_balances") is not True or safeguards.get("historical_replay_allowed") is not False:
        raise ValueError("existing point ledger protection not configured")
    if safeguards.get("immutable_event_keys") is not True or safeguards.get("reversal_requires_original_grant") is not True or safeguards.get("refunds_idempotent") is not True:
        raise ValueError("missing idempotence safeguards")
    excludes = safeguards.get("excluded_bo_tables")
    if not isinstance(excludes, list) or any(not isinstance(x, str) or not x.isidentifier() for x in excludes) or len(set(excludes)) != len(excludes):
        raise ValueError("invalid excluded board IDs")
    ai = policy.get("ai_settlement")
    if not isinstance(ai, dict) or ai.get("rate") != "1P_per_1_KRW_actual_cost" or ai.get("requires_actual_usage") is not True or ai.get("requires_admin_fx") is not True or ai.get("failed_or_free_reply_charge") != 0:
        raise ValueError("invalid actual AI usage policy")
    if set(policy.get("award_targets", {})) != {"register_on_approval", "login_daily", "write_created", "comment_created", "recommendation_received"}:
        raise ValueError("award events incomplete")
    if set(policy.get("charge_targets", {})) != {"read", "download"}:
        raise ValueError("charge events incomplete")
    for group in ("award_targets", "charge_targets"):
        for event, row in policy[group].items():
            if not isinstance(row, dict):
                raise ValueError("invalid " + event)
            amount = row.get("amount")
            if amount is not None and (type(amount) is not int or abs(amount) > 100000):
                raise ValueError("invalid " + event + " amount")
            if amount is not None and group == "award_targets" and amount < 0:
                raise ValueError("negative award amount: " + event)
    if policy["award_targets"]["recommendation_received"].get("enabled") is not False:
        raise ValueError("unapproved recommendation rewards")


def audit(policy, snapshot=None):
    validate_policy(policy)
    if snapshot is None:
        return {"status": "snapshot_required", "mode": "read_only",
                "existing_member_rows_changed": 0, "point_ledger_rows_changed": 0,
                "reason": "live point configuration not verified"}
    if not isinstance(snapshot, dict) or set(snapshot) != {"config", "boards"}:
        raise ValueError("snapshot must have only sanitized config and boards")
    config = snapshot["config"]
    boards = snapshot["boards"]
    if not isinstance(config, dict) or set(config) != set(CONFIG_FIELDS):
        raise ValueError("invalid config snapshot fields")
    for field in CONFIG_FIELDS:
        check_int(config[field], field)
    if not isinstance(boards, list) or not boards or len(boards) > 500:
        raise ValueError("invalid board snapshot")
    by_field = defaultdict(set)
    names = set()
    exceptions = set(policy["safeguards"]["excluded_bo_tables"])
    for board in boards:
        if not isinstance(board, dict) or set(board) != {"bo_table", *BOARD_FIELDS}:
            raise ValueError("invalid sanitized board fields")
        name = board["bo_table"]
        if not isinstance(name, str) or not name.isidentifier() or name in names:
            raise ValueError("invalid or duplicate board")
        names.add(name)
        if name in exceptions:
            continue
        for field in BOARD_FIELDS:
            by_field[field].add(check_int(board[field], field))
    if not any(name not in exceptions for name in names):
        raise ValueError("no standard boards")
    observed = {field: sorted(values) for field, values in by_field.items()}
    observed["cf_register_point"] = [config["cf_register_point"]]
    observed["cf_login_point"] = [config["cf_login_point"]]
    expected = {
        "cf_register_point": policy["award_targets"]["register_on_approval"]["amount"],
        "cf_login_point": policy["award_targets"]["login_daily"]["amount"],
    }
    expected.update({field: (policy["award_targets"][event]["amount"]
              if event in policy["award_targets"] else policy["charge_targets"][event]["amount"])
              for event, field in BOARD_TARGETS.items()})
    unknown = sorted(k for k, v in expected.items() if v is None)
    mismatch = {k: {"expected": expected[k], "observed": observed[k]}
                for k in expected if expected[k] is not None and observed[k] != [expected[k]]}
    inconsistent = {k: observed[k] for k in BOARD_FIELDS if len(observed[k]) > 1}
    warnings = []
    if config["cf_use_point"] != 1:
        warnings.append("native_point_system_disabled")
    if policy["safeguards"]["point_expiry_days"] is None:
        warnings.append("point_expiration_unconfirmed")
    elif config["cf_point_term"] != policy["safeguards"]["point_expiry_days"]:
        warnings.append("point_expiration_mismatch")
    if policy["award_targets"]["register_on_approval"]["approval_hook_required"]:
        warnings.append("signup_approval_award_gate_not_verified")
    if policy["award_targets"]["recommendation_received"]["custom_hook_required"]:
        warnings.append("recommendation_hook_not_verified")
    # Audit cannot assert production compliance while values or approval hooks are unverified.
    return {
        "status": "drift_detected" if mismatch else "rates_unconfirmed" if unknown else "hook_verification_required",
        "mode": "read_only",
        "point_system_enabled": config["cf_use_point"] == 1,
        "audited_board_count": len(names - exceptions),
        "excluded_board_count": len(names & exceptions),
        "observed_amounts": observed,
        "inconsistent_board_rates": inconsistent,
        "unconfirmed_target_fields": unknown,
        "mismatched_target_fields": mismatch,
        "warnings": warnings,
        "existing_member_rows_changed": 0,
        "point_ledger_rows_changed": 0
    }


def main():
    parser = argparse.ArgumentParser(description="Local-only read-only Busan point settings audit")
    parser.add_argument("--snapshot", type=Path, help="Sanitized admin snapshot JSON; do not supply member rows")
    args = parser.parse_args()
    policy = json.loads(POLICY_PATH.read_text(encoding="utf-8"))
    snapshot = json.loads(args.snapshot.read_text(encoding="utf-8")) if args.snapshot else None
    print(json.dumps(audit(policy, snapshot), ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
