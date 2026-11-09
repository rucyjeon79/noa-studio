# N80 media runtime on the existing NOA host

The user's execution target is the existing NOA STUDIO hosting account. Do not
ask for another PC/VPS based only on missing executables in PATH. Use the existing
pinned hosting connection and report actual process results.

## Installed and verified

- SSH command execution succeeds on the hosting account.
- The host does not expose Node/browser executables on the tested PATH.
- Node `v24.22.2` was installed and executed in the private N80 runtime directory:
  `/hosting/noastudio/noa-ai-lab/host-runtime`.
- The official Node binary could not initially start because of missing shared
  libraries. Its linked system libraries were installed alongside it; invoking
  the private loader produced a real, successful Node version response.
- Node SHA-256: `904a6d3484241d466989f9df9ba3aab822b1496191bdb28230eb491a55c32a52`.
- Live evidence: [host Node execution](https://github.com/rucyjeon79/noa-studio/actions/runs/42589586971).
- Existing signed PHP capabilities reported `shell_exec_callable=true` and
  `proc_open_callable=false`. This is not evidence that arbitrary PHP subprocess
  automation or an authenticated browser is available.

## Ownership and installation

`scripts/n80_auto.py ai.host_runtime` is registered in `config/n80-automation.json`
and owned by the existing `.github/workflows/noa-ai-worker.yml`. It is a bounded
installation/startup operation, not another cron or MV queue. Its concurrency
lane is separate from periodic ticks so a scheduled run cannot replace a pending
host installation. The normal AI worker schedule is unchanged.

`scripts/noa_host_media_runtime.py` transfers the official `setup-node` executable
and required libraries over the existing pinned SFTP connection. Private files
are checksum verified before execution. Existing runtimes are not overwritten;
failed newly installed files are removed. Successful runtime files remain on the
host. No Google login profiles or browser cookies are copied from ChatGPT.

`scripts/noa_host_browser_runtime.py` prepares the official Playwright 1.62.0
headless browser and its linked libraries. Only English/Korean browser locales
are retained. A fresh temporary profile and a bounded `about:blank` launch test
are used. Sandbox restrictions are not disabled. A successful version command
or package transfer is not treated as a successful browser page load.

## Completion boundary

The current installer does not authenticate Gemini/Flow, claim the existing MV
job, generate images/video, or install an unattended browser executor. Those are
subsequent execution stages, and must be proven separately. Keep
`authenticatedProvider` and `productionReady` false until real execution evidence
supports the corresponding capability. The current MV remains in the existing
N80 store; no replacement task or duplicate media queue was created.

Validation currently covers SSH/SFTP-only distinctions, actual process receipts,
failure redaction, successful Node version parsing, browser sandbox failure, and
N80 operation ownership. The local action used by daily Shorts is included in
the operation ownership test.

## Recovery checkpoint — 2026-11-09

- Continue the existing movie `8491b2cebbdb452ac654d152f3455685`, current source
  `single:echoes-of-joseon:13`, revision 5. The source was checked current during
  takeover. The paused plan is 49 seconds / 7 scenes; no replacement movie or
  generation request was created by the runtime repair.
- Browser integrity validation runs on the host against a SHA-256 manifest.
  The tiny verifier and manifest are read back before use. Failed integrity
  checks never start the browser.
- Run `42594375499` tested `dccaca2` and timed out after 15 minutes without
  producing a final runtime receipt. It does not prove browser readiness.
- Concurrent Node work added system SHA-256 verification in `667bdc7`, avoiding
  full executable downloads when the host's checksum tool is available.
  `faa9a13` preserves the browser validation tests and Node status flag.
- `runtime.json` is now checkpointed before connection, Node verification,
  browser installation and PHP capability checks, then atomically replaced with
  the final receipt. A timeout can retain the last phase without marking it
  complete. Browser staging counts and final hash verification are separate logs.

## Browser loader correction

A local reproduction showed that invoking Chromium through `ld-linux` directly
makes `/proc/self/exe` identify the loader, breaking ICU/resource discovery. The
installer now patches a copy of each browser executable to use the private ELF
interpreter and launches the browser directly. `LD_LIBRARY_PATH` is scoped to the
browser child. This keeps resource/subprocess paths correct without disabling
the sandbox. Uploaded bytes are verified on the host against a hashed manifest.
A host page-load result is still required before reporting browser readiness.

Node run `42595643431` verified its binary and source, then failed at the signed
HTTP roundtrip with `node_network_und_err_connect_timeout`. The latest Node
changes address that network path separately from this browser recovery.
