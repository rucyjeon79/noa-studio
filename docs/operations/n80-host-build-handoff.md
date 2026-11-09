# N80 host ownership and remaining MV work

User decision, 2026-11-09: additional development and existing external builds
must be handed to the existing host's N80. External build helpers do not become
independent production engines. No new host or paid-provider substitution is
authorized by this integration.

## Code and build destinations

| Component | Existing location | N80 handoff and actual status |
| --- | --- | --- |
| PHP application, permissions, source songs and job state | Existing NOA host | Remain authoritative; no replacement database or queue |
| Node worker | Private host runtime | Activated and verified; existing Auto transport/leases |
| Browser package | Private host runtime | Binary version works; page startup blocked by missing procfs |
| Media analysis, assembly, subtitles and publication modules | Repository `lab/`, used by existing Actions worker | `ai.media_handoff` copies the 16 media source files and two Assistant connector files to private host N80 storage and verifies every byte before replacing `media-source-current.json`; this is source handoff, not runtime activation |
| ChatGPT Assistant connector v8 | Existing private Sites MCP endpoint | Published source commit `03717d6c2d6a5afd2cadf62228fd4b8b12235c00` is mirrored under `integrations/chatgpt-assistant/` and included in host handoff. All operations delegate to the existing host; no schedule or separate job store. The connector remains available so existing ChatGPT tools continue to reach N80 |
| APK and AAB | Android build artifacts | One workflow, `noa-android.yml`; `jukebox.android_publish` keeps the verified APK on the host and the same signed AAB in private `noa-android-builds`; publication metadata includes both hashes |
| Earlier standalone signed Android builds | Existing Actions artifacts | Duplicate workflow retired. Older or unverified candidates must not replace the current verified build; the canonical workflow creates and hands off the current release |
| Generated temporary scene files | Existing Drive connection / existing temporary asset mechanism | Preserve original asset references and current job; cleanup only after confirmed publication, playlist and related-video linkage |

GitHub remains the source, test/build and bounded transfer helper. Private host
code receipts set `executionReady=false`; copying files cannot authenticate Google,
enable providers, claim a movie or prove that a renderer has run. Existing useful
audio processing remains active until its replacement is actually verified.

The retired `noa-android-signed-release.yml` built APK/AAB a second time and retained
them only in Actions. The canonical Android workflow already produces both files,
performs device verification and publishes through N80, so a second build is not
needed. Receiving AAB on the host does not publish it to Google Play.

## Remaining work in dependency order

1. **Host browser prerequisites.** Run 42602885132 verified `ENOENT` for `/proc`,
   `/proc/self/exe` and `/proc/self/status`. The hosting provider must support a
   browser execution environment with procfs and sandbox facilities in this same
   account. Current account code cannot mount these facilities. Do not spoof the
   paths or disable sandboxing. Once configured, rerun the existing N80 bounded
   page test; further OS requirements may still appear.
2. **Persistent authorized browser executor.** Integrate Gemini/Flow session
   lifetime, login-required detection, bounded retries and file retrieval with
   the existing N80 task/lease. Existing Google connection alone does not prove
   the host browser has a usable authenticated session.
3. **Host media execution.** Install and verify ffmpeg/ffprobe and the required
   Python/audio/subtitle dependencies in the same private N80 runtime. Connect
   the handed-off modules to existing operations, verify a real assembly and
   subtitle job, then retire the corresponding external execution. Preserve
   existing active audio optimization until that replacement succeeds.
4. **Continue the real movie.** Read the current source again, continue paused
   job `8491b2cebbdb452ac654d152f3455685` rather than creating a duplicate, accept
   matching character images, obtain all 7 clips for the existing 49-second plan,
   review lyric timing and verify full decode, audio mapping and output hashes.
5. **Publication and cleanup.** Verify the intended channel, public result,
   playlist and related-video link through the existing N80 publication gates.
   Only then delete generated temporary files; preserve the source song and
   final accepted result. Test interrupted response recovery without duplicate
   generation or publication.

No finished video or fully autonomous MV operation is asserted by this handoff.
