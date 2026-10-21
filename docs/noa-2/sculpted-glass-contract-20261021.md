# Semi-Gloss Sculpted Glass · presentation contract

Continue deployed PRECISION GRID `94382d7` and compatible title checks `6576703`. Existing worktrees, source rows, permissions and processing files are preserved.

## Material and palette

`noa-ui.css` owns the material. Four broad radial gradients, one soft inset highlight, a short inset shade and a 2px/3px contact shadow create restrained convex depth. Shared sheen tuning is `.55`; this is a CSS calibration token, not a quantitative comparison to an unavailable image. No image, blur, backdrop filter, will-change hint, keyframe or continuous button animation is introduced.

Graphite and Ivory retain their existing theme IDs. `noa-design.json` keeps all preference schema/keys and supplies clean independent surface colors; Champagne, Silver, Warm Gray and Bronze bridge the palettes. Ivory uses neutral white/pearl rather than beige. The default CSS palette matches the Graphite JSON fallback.

## Ownership and action preservation

`NoaGlass` in shared `noa-ui.js` marks known primary controls. It never replaces action nodes, SVG nodes, callbacks, URLs, IDs, forms or data attributes. Existing accessible names remain; short visible labels use an added presentation attribute and CSS pseudo-content. Dynamic play/pause labels follow the existing player state. Existing expanded/collapsed and disabled visibility rules remain authoritative.

Public music-row play, owner-rendered upload/download/processing controls, transport buttons, hero play, settings save, primary submit/download controls and selected creator-workspace entries receive material. General navigation, refresh/close/cancel actions and ordinary links keep their minimal design. Owner-only upload/download controls remain absent from anonymous HTML. Dedicated JUKEBOX, taxonomy and database pages are excluded pending safe handoff. No music, upload, queue, streaming, SQL or classification file is edited.

Native disabled controls retain browser behavior. An explicitly `aria-disabled=true` custom glass action is blocked in capture phase without replacing its action callback. Pressed/selected states highlight the edge, transient press uses a half-pixel downward response, and keyboard focus uses a visible 2px outline. Reduced motion removes transitions and pressed movement. The outer shape is a small rounded rectangle, with automatic content size and at least 44px touch area.

## Verification and acceptance limits

Existing card, hero, source-title, data-order and player regression gates remain. Additional browser checks cover both themes at 320/390/430, 768/1024, 1280/1920, 844×390 and 568×320. They inspect non-flat surface layers, inset shading, icon/label centering, clipping, touch area, palette-extrema contrast (4.5 text / 3 icons), state behavior, focus, reduced motion and scheduling overhead. Owner-only action shapes are explicit browser-memory fixtures; no upload/download request, SQL change or generated media job is submitted. Candidate creator templates are separately verified.

Production acceptance requires allowlisted SFTP deployment with version checks/private verified backup, protected-source hashes and live public browser gates. Actual authenticated upload/download/admin operations still need the corresponding signed-in session; shape fixtures are not reported as those operations. Physical-device/Safari testing is distinct from Chrome viewport testing.
