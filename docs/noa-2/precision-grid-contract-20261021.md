# PRECISION GRID display contract

Runtime presentation starts from the verified `a6d9c63` release and the latest `4c32463` production audit. SQL, classification, player state, media files and JUKEBOX code are not modified.

## Layout

Content frames share their gutter and width tokens. Card tracks use two grid subdivisions per normal card. Partial rows start at the same first track. A featured card occupies exactly two normal columns plus their gap, beginning at the first track. Count five prefers 3+2, including wide screens. Text uses a two-line title block and a two-line metadata block; video artwork stays 16:9.

`window.NoaCardLayout.debug(true)` enables temporary CSS rulers. `debug(false)` removes them. Normal navigation does not enable debug mode or persist it to preferences.

## Source title preservation

`presentTitle(original, metadata)` uses `displayTitle` or `songTitle` when explicitly provided, otherwise the first meaningful source segment separated by `|`. EP prefixes remain visible. Presentation title nodes retain the complete source in `data-noa-original-title` and the native `title` attribute. Source rows, IDs, URLs and database titles remain unchanged.

## Rank movement adapter — delivered Work_데이터 contract

The integrated-v2 snapshot preserves source order and supplies `rank`, `previousRank`, signed `rankDelta`, `rankState`. `prepare(card, row)` consumes these exact fields; no client-side ranking, aggregation or fabricated comparison.

```json
{"rankState":"up","rank":2,"previousRank":5,"rankDelta":3}
```

- `rankState`: `up`, `down`, `same`, `new`; `unknown`, missing or inconsistent values render nothing.
- Existing rank pairs must be positive integers, match the signed delta, and agree with the state. Display uses the supplied delta magnitude.
- `new` requires a supplied rank and explicit null prior rank/delta. Missing comparison alone never implies NEW.
- Equal 16px up/down/minus icons share the ordinary/featured heading baseline; NEW uses a compact label.
- The delivered production snapshot currently reports unknown when adjacent hours use different rule versions. This remains blank as required.
- JUKEBOX collection is awaiting Work_뮤직 integration. Its empty ledger is not presented as historical zero listening. The UI keeps verified YouTube counts without falsely relabelling integrated scores as views.

Synthetic rank values exist only inside browser-memory tests and screenshots named `rank-contract-fixture`. They are never submitted to production APIs or persisted.

## Responsive hero

The existing one-shot muted playback policy is preserved. Portrait media height is bounded by the small viewport, copy and media share their edges, foreground artwork uses contain to preserve faces, and the control is aligned within the media grid cell. Autoplay denial and reduced motion retain the selected original poster.

## Protected ownership

The release allowlist contains shared UI assets and reviewed view asset URLs. Music/JUKEBOX code, taxonomy/schema/store code, home read-model/store code and AI LAB operation code are hashed before/after deployment. The JUKEBOX editor/upload surfaces are excluded from the new presentation controller pending safe handoff.

## Verification

A 1px tolerance covers container origins, featured/normal origins, inter-card gaps, same-row artwork/title/metadata baselines and card bottoms. Additional checks cover 320/390/430px phones, 768px portrait and 1024px landscape tablets, 1280/1920px desktop, 390→844/568 landscape→390 rotation, bottom player/navigation space, compact-title preservation, native hero behavior and existing playback regression tests. Actual YouTube audio output and ordinary-member authenticated flows remain separately reported acceptance limits.
