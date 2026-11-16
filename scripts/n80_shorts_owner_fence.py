"""Fail-closed checkpoint fence for a bounded, off-host N80 Shorts job.

Only the already authorised SFTP owner-control probe is used by callers.
No job lease or output can be mutated by this module, and it never starts
a process, makes a provider request, or opens an external network connection.
"""
import time


class OwnerStopLatched(RuntimeError):
    """N80 owner disabled the job or their stop state cannot be verified."""


# These operations transfer bounded chunks or read catalog/video metadata.
# Recheck at a short interval rather than reconnecting to SFTP for EVERY chunk.
PERIODIC = frozenset((
    'catalog', 'youtube', 'storage_read', 'assembly_read', 'assembly_write'
))


def make_guarded_dispatch(sender, owner_probe, *, clock=time.monotonic, max_age_seconds=10):
    if not callable(sender) or not callable(owner_probe):
        raise TypeError("dispatch_and_owner_probe_required")
    if not 1 <= max_age_seconds <= 30:
        raise ValueError("invalid_owner_check_interval")
    last_checked = None

    def require_owner():
        nonlocal last_checked
        try:
            allowed, _reason = owner_probe()
        except Exception:
            raise OwnerStopLatched("n80_owner_control_unreachable") from None
        if allowed is not True:
            raise OwnerStopLatched("n80_owner_stop_or_pause_latched")
        last_checked = clock()

    def dispatch(command='', **fields):
        # Fail closed if the owner stopped N80 after this GitHub job started.
        # Recheck before every lease, external storage reservation, completion
        # and publication operation. Bulk media chunks are checked at most
        # ten seconds apart to avoid SFTP connection churn on shared hosting.
        if last_checked is None or command not in PERIODIC or clock() - last_checked >= max_age_seconds:
            require_owner()
        return sender(command, **fields)

    dispatch.require_owner = require_owner
    return dispatch
