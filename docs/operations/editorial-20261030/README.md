# Company and legal presentation, 2026-10-30

Three public, server-rendered pages use one scoped stylesheet and existing NOA navigation. The company story follows the owner's supplied facts: 제이알, 전서진, 람준파파 (하람·하준 두 아들의 아빠), NOA's creator and worldbuilder, NOEL as the creator's alter ego, and 별무리. Official character portraits are preserved. The generated starlit piano studio is illustrative artwork, not a photograph of the company's premises.

Legacy `/bbs/content.php?co_id=privacy` and `provision` render the same documents through an additive extension. Core files and content DB rows remain untouched. Native registration uses the shared text only for registration requests. Home footer and site map expose the company page.

## Publication limitations to resolve with the operator

- The owner selected email contact but has not supplied an address. No guessed email, telephone, company address, registration number, or designated privacy officer is published. Existing login-required 1:1 inquiry is linked; its post-login submission was not tested.
- Privacy is an initial service-specific disclosure, not a legal compliance certification. Exact outsourcing counterparties, overseas transfer destinations/legal basis/retention/contact, backup processing (including whether personal data is in Drive backups), and category-specific deletion schedules require operational verification and completion. The public overseas-processing section explicitly states that separate, specific disclosure is needed and that publication is not consent.
- Existing incomplete content cannot establish prior acceptance. These terms do not assume retroactive acceptance of adverse changes or alter prices, point conversion, automatic billing, retention jobs, member records, or payment configuration.
- Confirm a non-login contact channel and accountable privacy contact before treating the privacy notice as finalized. Verify actual deletion procedures match the notice. Any missing age/guardian or overseas-transfer consent implementation is a separate operational issue, not silently declared implemented here.

## Sources reviewed

- PIPC privacy notice guidance, April 2026: https://www.privacy.go.kr/front/bbs/bbsList.do?bbsNo=BBSMSTR_000000000049
- Privacy Act Article 30: https://www.law.go.kr/LSW/lsLinkCommonInfo.do?lsJoLnkSeq=1029334833
- E-commerce Enforcement Decree Article 6 (July 2026): https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1018638379
- Digital content standard terms: https://www.law.go.kr/admRulLsInfoP.do?admRulSeq=2100000216089

## Artwork

Built-in Imagegen generated `deploy/noa-assets/editorial/starlight-studio.webp`, with source retained in the generation output. Prompt: restrained cinematic composer studio facing a starry ocean, black grand piano and amber lamp on the right, dark negative space left, ivory/charcoal/champagne palette, no people, logos or text. WebP delivery is approximately 122 KB. Official NOA and NOEL portraits derive from the unchanged `public/characters/*-sheet.png` (the official front portrait is framed with CSS) assets.

## Verification

PHP 8.2 syntax and functional content tests run in GitHub Actions; local environment has no PHP binary. Tests cover section targets, guest access, native legacy routes, required owner facts, escaping, external-link isolation and plain-text consent. Deployment uses existing host-key pinning, remote-preimage checks, protected-file hashes and conditional rollback. Postflight verifies five document routes, home discovery, and delivered image hashes. Browser visual review follows on the official site.
