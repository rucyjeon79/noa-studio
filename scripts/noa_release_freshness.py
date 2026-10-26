"""Keep tested NOA releases current without unrelated Busan commit starvation."""
import re
import subprocess


def require_current_candidate(head, candidate, unrelated_prefixes=(), cwd=None):
    if not all(re.fullmatch(r'[0-9a-f]{40}', sha or '') for sha in (head, candidate)):
        raise RuntimeError('invalid_release_commit')
    if head == candidate:
        return
    if not unrelated_prefixes:
        raise RuntimeError('obsolete_candidate_no_operating_files_changed')

    def git(*args):
        return subprocess.run(['git', *args], cwd=cwd, check=True,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=45)

    try:
        git('cat-file', '-e', head + '^{commit}')
    except subprocess.CalledProcessError:
        git('fetch', '--no-tags', 'origin', head)
    git('merge-base', '--is-ancestor', candidate, head)
    # Disable rename detection so moving a NOA dependency into another directory
    # still records its original, protected source path.
    changed = git('diff', '--no-renames', '--name-only', '-z', candidate, head, '--').stdout
    paths = [p.decode('utf-8') for p in changed.split(b'\0') if p]
    if any(not p.startswith(tuple(unrelated_prefixes)) for p in paths):
        raise RuntimeError('obsolete_candidate_no_operating_files_changed')

