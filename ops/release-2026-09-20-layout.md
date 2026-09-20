# Android release 0.7.4

Version code 15; source commit 049053de887b9a9a1c4a17012688c541119b3ae5.

ChronBible Journey, Progress, and Leaderboard tabs now follow the webpage content order. The leaderboard appears inline, with welcome/name editing, points, milestones, and an expandable reader list. Removed the continue-reading panels, including the home guide resume card. Includes the earlier search removal and tabs draft.

Earned badge galleries have four equal-width columns, with artwork resizing to fit narrow screens. Full-screen badge viewing and completion/account guards are preserved.

Build: https://github.com/tryjesusmedia/tryjesusjourney/actions/runs/35531130635

Build succeeded. Artifact ID: 10611727664. AAB SHA-256: cd4d0fcf4126ea7bc63fcd33c6145c337fcef25d41cb55db9226f502b5d638bd.

Both archive integrity and Android bundletool 1.18.3 validation passed. Manifest version codes were verified.

Status: Google Play upload is blocked. Play Console repeatedly reports: "There was an error uploading the Android App Bundle. Try again later or contact Google Play developer support if the error persists." The new app version has NOT been submitted for review or published. Release name and notes are saved as a production draft. Previous releases remain untouched.

Validation: typecheck and lint passed. Relevant progress, rewards, badges, auth callback, and account isolation checks passed.

Website commit ec4a03e385aaad5cc39e4e1640e098476fba4b5c is live. ChronBible progress no longer has a continue-reading aside. Bible and Conflict already had no resume panel. Live assets were verified against the committed source.
