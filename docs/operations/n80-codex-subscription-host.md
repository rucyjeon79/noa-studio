# N80 subscription CLI: verified existing-host boundary, 2026-11-11

The target is the existing Dothome NOA host. Do not ask the user for another
always-on server or PC. Preserve the existing host N80 scheduler and its SQL
queues. ChatGPT subscription use is preferred; paid API fallback is not enabled.

## Actual evidence

- The existing SSH/SFTP channel works on port 2022 with the established pinned
  host key. Node v24.22.2 and the single N80 Hub runner remain active.
- Host Node HTTPS checks to github.com, auth.openai.com, and chatgpt.com time out
  in DNS lookup. Resolver configuration and hosts files are readable. This does
  not prove that every client or PHP has the same network failure.
- OpenAI's official Codex 0.167.1 x86_64 musl archive was downloaded and verified
  against its published SHA-256 before transferring only its native executable.
- The host actually ran `codex --version` successfully. `exec --help` exposes
  ignore-user-config, ephemeral, output-schema, and JSON options.
- Both `login status` and `features list` fail during configuration loading:
  `no /proc/self/exe available. Is /proc mounted?`
- Repeating those fixed diagnostics with the supported `--no-daemon` flag
  produces the same prerequisite error. Do not repeat it as a proposed fix.
- OpenAI source `codex-rs/config/src/loader/mod.rs` at rust-v0.167.1 calls
  `std::env::current_exe()?` when resolving embedded package defaults. Ignoring
  user configuration does not skip that preceding step. No supported CLI
  configuration correction was identified in this investigation.

No device login, model generation, media generation, or publication was started.
The existing shorts job and its assets were not changed. Version output alone
does not establish a usable subscription worker or unattended readiness.

## Recorded runs

- DNS-stage evidence: https://github.com/rucyjeon79/noa-studio/actions/runs/42929479468
- Verified native installation: https://github.com/rucyjeon79/noa-studio/actions/runs/42929865264
- Actual initialization failure: https://github.com/rucyjeon79/noa-studio/actions/runs/42930565208

The unusable 320,186,856-byte executable is removed only if its hash still equals
`dd5bfdf19d794dcc6fb482d2d5a2d9fb31d11f6caa44b303bb72890d461e8a02`.
The private `noa-hub/codex/status.json` retains the blocked receipt. Host control,
web source, member data, music, images, and existing runtime files are preserved.
No recurring workflow or new worker is enabled. Repeating setup requires new
evidence that the host prerequisite has changed.

## Decision boundary

An N80-owned, request-only external executor on the existing GitHub environment
is a possible alternative to investigate; N80 would retain queue/lease/result
ownership on the host. This is not implemented or verified and would retain a
GitHub execution dependency, unlike the existing GitHub-independent operations.
The earlier browser-only fallback does not prove this subscription AI path.
Do not silently describe it as satisfying GitHub dependency removal or as
complete unattended Gemini/Flow/YouTube automation.

Do not fake procfs, weaken sandbox restrictions, copy Work-session credentials,
start a paid API fallback, or patch/rebuild Codex merely to hide this failure.
