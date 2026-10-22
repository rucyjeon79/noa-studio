"""Per-host exclusive SFTP lock, independent from other DotHome accounts."""
import posixpath, stat, time, uuid
from noa_deploy_hosts import resolve_host

class HostLock:
    def __init__(self,profiles,host_id,sftp):
        self.host=resolve_host(profiles,host_id)
        self.sftp=sftp
        self.path=posixpath.join(self.host.private_root,'.noa-deploy-lock')
        self.token=uuid.uuid4().hex
        self.owned=False

    def acquire(self):
        if self.owned:raise RuntimeError('lock_already_owned')
        try:
            self.sftp.mkdir(self.path,0o700)
        except OSError as error:
            raise RuntimeError('host_deploy_lock_unavailable') from error
        self.owned=True
        return self

    def verify(self):
        if not self.owned:return False
        try:
            st=self.sftp.lstat(self.path)
            return stat.S_ISDIR(st.st_mode)
        except OSError:
            return False

    def release(self):
        if not self.owned:return
        if not self.verify():raise RuntimeError('host_deploy_lock_lost')
        self.sftp.rmdir(self.path)
        self.owned=False

    def __enter__(self):return self.acquire()
    def __exit__(self,exc_type,exc,tb):self.release()
