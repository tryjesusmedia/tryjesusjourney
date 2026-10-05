# Try Jesus: The Journey — ChronBible authority

The authoritative ChronBible plan and guide is the Google Doc:
https://docs.google.com/document/d/11JsQNJrr6Q4_seXuJbVr2zzXyA5esrp3ud5ixP9AbOw/edit

Read the current document before editorial changes. The website repository `tryjesusmedia/tjm` holds its reviewed snapshot and builder under `chronbible/` and `scripts/build-chronological-plan.mjs`. The app's `data/chronologicalBiblePlan.json` must match that verified document edition, including order, titles, exact verse ranges, section boundaries, and guidance. The document controls when older repository definitions disagree.

The current app and website share `chronological-bible-doc-v5` progress (0–1439 passage indices) and `get_chronbible_doc_leaderboard`. Never reuse a progress ID when passage indices change. Preserve earlier progress rows, offline guest/account separation, historical notes/highlights, and detached-account ownership. Do not equate reading numbers across versions.

Before Android releases run typecheck, lint, document-plan, document-progress, chronological-state, bible-reader, journey-rewards, and auth-callback tests. Use the established `.github/workflows/eas-android-production.yml` signed AAB workflow. Increment Android versionCode without changing the package or signing identity. Do not submit to Play or build/submit iOS unless requested. Never include credentials in deliverables.
