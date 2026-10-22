"""Fail-closed identity gate for automatic production releases."""
import json, os, subprocess, urllib.request

def main():
    event=os.environ.get("GITHUB_EVENT_NAME","")
    sha=os.environ.get("GITHUB_SHA","")
    repo=os.environ.get("GITHUB_REPOSITORY","")
    token=os.environ.get("GITHUB_TOKEN","")
    approved=os.environ.get("NOA_APPROVED_RELEASE_SHA","")
    head=subprocess.check_output(["git","rev-parse","HEAD"],text=True).strip()
    remote=subprocess.check_output(["git","rev-parse","origin/main"],text=True).strip()
    if len(sha)!=40 or head!=remote or not repo or not token:
        raise RuntimeError("invalid_checkout")
    if event=="push":
        if sha!=head: raise RuntimeError("push_checkout_mismatch")
        request=urllib.request.Request(
            f"https://api.github.com/repos/{repo}/commits/{sha}/pulls",
            headers={"Authorization":f"Bearer {token}","Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"})
        with urllib.request.urlopen(request,timeout=15) as response:
            prs=json.load(response)
        if not any(p.get("merged_at") and p.get("base",{}).get("ref")=="main" and p.get("merge_commit_sha")==sha for p in prs):
            raise RuntimeError("push_without_merged_pr")
    elif event in ("workflow_dispatch","release"):
        if not approved or approved!=head: raise RuntimeError("explicit_approval_missing")
    else: raise RuntimeError("invalid_release_event")
    with open(os.environ["GITHUB_ENV"],"a") as f:
        f.write(f"NOA_APPROVED_RELEASE_SHA={head}\nNOA_RELEASE_COMMIT={head}\nNOA_RELEASE_SHA_VALIDATED=1\n")
    print("RELEASE_IDENTITY_VALIDATED",head)
if __name__=="__main__":main()
