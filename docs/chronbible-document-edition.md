# ChronBible document edition — Android 0.9.0 (20)

The Google Doc in AGENTS.md is the editorial authority. Its revision is stored in `data/chronologicalBiblePlan.json` under `source.revisionId`. This Android release uses the same JSON and badges as the deployed website edition. Future editorial changes require a fresh document read and a reviewed app build; the bundle does not silently fetch replacement plans.

This release includes 313 titled readings, 11 sections, 1,440 exact passage tasks, daily guidance, section introductions/reflections, the reading guide, people/places, glossary, and Bible book index. In-app KJV passage parsing assigns all 31,102 verses once. Links and inline Bible reading use the same precise ranges. The existing public-domain KJV/WEB reader remains available. Recent label-fitting and Members Page improvements are included.

Progress migrates by assigned verses into the same v5 plan as the website. Existing website v5 progress takes priority over legacy app snapshots. Offline guest and account snapshots migrate separately; detached snapshots remain linked to their original account. Old local and cloud records are retained. Existing notes and highlights keep their historical identities. New-edition badges and 10-point passage scores match the website.

Tests:
- `npm run typecheck`
- `npm run lint`
- `node scripts/test-document-plan.mjs`
- `node scripts/test-document-progress.cjs`
- `npm run test:chronological-state`
- `npm run test:bible-reader`
- `npm run test:journey-rewards`
- `npm run test:auth-callback`

The signed Google Play artifact is an AAB inside the download ZIP. Extract the ZIP and upload the AAB, not the ZIP. This does not submit a store release automatically.
