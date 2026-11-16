#!/usr/bin/env python3
"""Retired resident-runner acceptance entry point; never opens a host connection.

The resident runtime was physically removed on 2026-11-17. Use authenticated
N80 Hub status/retirement verification and each module's one-shot receipts.
The former SSH launcher and heartbeat-polling implementation is Git history only.
"""


def main():
    raise SystemExit("resident_runner_retired_use_noa_hub_status")


if __name__ == "__main__":
    main()
