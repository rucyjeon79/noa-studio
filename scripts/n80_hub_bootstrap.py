"""N80 legacy resident Hub bootstrap, permanently retired 2026-11-17.

The owner-managed direct N80 Hub release is the only production source updater.
GitHub must never reinstall a detached host Node runner or poll the host.
Historical implementation is retained in Git history and Drive backups.
"""

def main():
    raise RuntimeError("hub_resident_runner_retired")

if __name__ == "__main__":
    main()
