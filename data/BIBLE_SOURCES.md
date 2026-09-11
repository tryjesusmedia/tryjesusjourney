# Bundled Bible sources

The app bundles the 66-book Protestant editions below so KJV and WEB passages can be read without leaving the app.

- KJV: eBible.org `eng-kjv2006` verse-per-line archive, 1,189 chapters and 31,102 verse records: <https://ebible.org/Scriptures/eng-kjv2006_vpl.zip>
- WEB: eBible.org `engwebp` (World English Bible, Protestant edition) verse-per-line archive, 1,189 chapters and 31,103 verse records: <https://ebible.org/Scriptures/engwebp_vpl.zip>

The source archives' accompanying metadata and rights notices remain authoritative. `scripts/import-web-bible.mjs` converts either VPL file to the app's chapter-keyed JSON format without rewriting the verse text. Examples:

```powershell
node scripts/import-web-bible.mjs eng-kjv2006_vpl.txt data/kjv.json 31102
node scripts/import-web-bible.mjs engwebp_vpl.txt data/web.json 31103
```

Highlight offsets use only verse text, with one newline between verses. Verse numbers are visual labels and are not part of the stored text. Keep this format identical on the website and app so synced highlights select the same words.
