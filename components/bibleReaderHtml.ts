import type { BiblePassageSection } from '@/data/bible';
import { contiguousVerseGroups } from '@/data/bibleReferenceCore';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function verseHtml(verse: BiblePassageSection['verses'][number]) {
  return `<span class="verse-row"><span class="verse-number" aria-hidden="true">${verse.verse}</span><span class="verse-text">${escapeHtml(verse.plainText)}</span></span>`;
}

export function bibleReaderHtml(sections: BiblePassageSection[]) {
  const content = sections.map((section) => {
    const groups = contiguousVerseGroups(section.verses);
    const scripture = groups.map((group, groupIndex) => {
      const first = group[0]?.verse ?? 0;
      const last = group.at(-1)?.verse ?? first;
      const separator = groupIndex < groups.length - 1 ? '<span class="omission" aria-hidden="true">⋯</span>' : '';
      return `<div class="scripture" data-selection-group="${first}-${last}">${group.map(verseHtml).join('')}</div>${separator}`;
    }).join('');
    return `<section class="chapter"><h2>${escapeHtml(section.displayReference)}</h2>${scripture}</section>`;
  }).join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=yes">
<style>
  :root{color-scheme:light}*{box-sizing:border-box}html,body{margin:0;max-width:100%;overflow-x:hidden;background:#F7F0E2;color:#292126}
  body{padding:18px 18px 96px;font-family:Georgia,'Times New Roman',serif;-webkit-text-size-adjust:100%}
  .chapter{max-width:760px;margin:0 auto 28px}.chapter h2{position:sticky;top:0;z-index:5;margin:0 -4px 15px;padding:10px 4px 9px;background:rgba(247,240,226,.96);color:#4A263B;font:900 20px/1.25 system-ui,sans-serif;border-bottom:1px solid #D6C49C}
  .scripture{display:block;overflow-wrap:anywhere;word-break:normal;font-size:19px;line-height:1.72;user-select:text;-webkit-user-select:text}
  .verse-row{display:block;position:relative;padding-left:29px;margin-bottom:9px}.verse-number{position:absolute;left:0;top:.4em;width:23px;color:#8A5B16;font:900 11px/1 system-ui,sans-serif;text-align:right;user-select:none;-webkit-user-select:none}.verse-text{white-space:pre-wrap}
  .omission{display:block;text-align:center;color:#8A776C;font:700 18px/1 system-ui,sans-serif;margin:-11px 0 10px;user-select:none;-webkit-user-select:none}
</style></head><body>${content || '<p>This passage could not be loaded.</p>'}</body></html>`;
}
