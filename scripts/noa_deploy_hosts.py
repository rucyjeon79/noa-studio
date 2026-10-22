"""Host isolation contracts for future DotHome multi-account deployments.

No credentials, network operations or mutation in this module.
"""
from dataclasses import dataclass
import re

HOST_ID = re.compile(r"^[a-z][a-z0-9-]{2,39}$")

@dataclass(frozen=True)
class HostProfile:
    host_id: str
    remote_root: str
    private_root: str
    environment: str = "production"

    def __post_init__(self):
        if not HOST_ID.fullmatch(self.host_id):
            raise ValueError("invalid_host_id")
        if not self.remote_root.startswith("/hosting/") or "/../" in self.remote_root or not self.remote_root.endswith("/html"):
            raise ValueError("invalid_web_root")
        if not self.private_root.startswith("/hosting/") or "/../" in self.private_root or self.private_root.startswith(self.remote_root + "/"):
            raise ValueError("invalid_private_root")
        if self.environment not in ("production", "staging"):
            raise ValueError("invalid_environment")

    @property
    def lock_key(self):
        return f"{self.host_id}-{self.environment}"

    @property
    def state_file(self):
        return f"{self.private_root}/current-release.json"


def resolve_host(profiles, selected_id):
    """Require explicit selection, never fall back to another account."""
    if not selected_id:
        raise ValueError("host_selection_required")
    if selected_id not in profiles:
        raise ValueError("unknown_host")
    host = profiles[selected_id]
    if host.host_id != selected_id:
        raise ValueError("host_identity_mismatch")
    return host
