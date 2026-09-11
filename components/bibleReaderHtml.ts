import type { BiblePassageSection } from '@/data/bible';
import { contiguousVerseGroups } from '@/data/bibleReferenceCore';
import { HIGHLIGHT_COLOR_HEX, type BibleHighlight } from '@/lib/bibleHighlightsCore';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function verseHtml(verse: BiblePassageSection['verses'][number], highlights: BibleHighlight[]) {
  const source = verse.plainText;
  const rangeEnd = verse.startOffset + source.length;
  const relevant = highlights
    .filter((highlight) => highlight.startOffset < rangeEnd && highlight.endOffset > verse.startOffset)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const boundaries = new Set([verse.startOffset, rangeEnd]);
  relevant.forEach((highlight) => {
    boundaries.add(Math.max(verse.startOffset, Math.min(rangeEnd, highlight.startOffset)));
    boundaries.add(Math.max(verse.startOffset, Math.min(rangeEnd, highlight.endOffset)));
  });
  const points = [...boundaries].sort((left, right) => left - right);
  let content = '';
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const text = escapeHtml(source.slice(start - verse.startOffset, end - verse.startOffset));
    const active = relevant.find((highlight) => highlight.startOffset < end && highlight.endOffset > start);
    content += active
      ? `<mark role="button" tabindex="0" aria-label="Open highlight and note" data-highlight-id="${escapeHtml(active.id)}" style="background:${HIGHLIGHT_COLOR_HEX[active.color]}">${text}</mark>`
      : text;
  }
  return `<span class="verse-row"><span class="verse-number" aria-hidden="true">${verse.verse}</span><span class="verse-text" data-start="${verse.startOffset}" data-end="${rangeEnd}">${content}</span></span>`;
}

export function bibleReaderHtml(sections: BiblePassageSection[], highlights: BibleHighlight[]) {
  const content = sections.map((section) => {
    const sectionHighlights = highlights.filter((highlight) => highlight.chapterLabel === section.chapterLabel);
    const groups = contiguousVerseGroups(section.verses);
    const scripture = groups.map((group, groupIndex) => {
      const first = group[0]?.verse ?? 0;
      const last = group.at(-1)?.verse ?? first;
      const separator = groupIndex < groups.length - 1 ? '<span class="omission" aria-hidden="true">⋯</span>' : '';
      return `<div class="scripture" data-chapter="${escapeHtml(section.chapterLabel)}" data-selection-group="${first}-${last}">${group.map((verse) => verseHtml(verse, sectionHighlights)).join('')}</div>${separator}`;
    }).join('');
    return `<section class="chapter"><h2>${escapeHtml(section.displayReference)}</h2>${scripture}</section>`;
  }).join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=yes">
<style>
  :root{color-scheme:light}*{box-sizing:border-box}html,body{margin:0;max-width:100%;overflow-x:hidden;background:#F7F0E2;color:#292126}
  body{padding:18px 18px 96px;font-family:Georgia,'Times New Roman',serif;-webkit-text-size-adjust:100%}
  .chapter{max-width:760px;margin:0 auto 28px}.chapter h2{position:sticky;top:0;z-index:5;margin:0 -4px 15px;padding:10px 4px 9px;background:rgba(247,240,226,.96);color:#4A263B;font:900 20px/1.25 system-ui,sans-serif;border-bottom:1px solid #D6C49C}
  .scripture{display:block;overflow-wrap:anywhere;word-break:normal;font-size:19px;line-height:1.72;user-select:text;-webkit-user-select:text;-webkit-touch-callout:none}
  .verse-row{display:block;position:relative;padding-left:29px;margin-bottom:9px}.verse-number{position:absolute;left:0;top:.4em;width:23px;color:#8A5B16;font:900 11px/1 system-ui,sans-serif;text-align:right;user-select:none;-webkit-user-select:none}.verse-text{white-space:pre-wrap}mark{color:inherit;border-radius:3px;padding:1px 0;cursor:pointer;-webkit-box-decoration-break:clone;box-decoration-break:clone}
  .omission{display:block;text-align:center;color:#8A776C;font:700 18px/1 system-ui,sans-serif;margin:-11px 0 10px;user-select:none;-webkit-user-select:none}
</style></head><body>${content || '<p>This passage could not be loaded.</p>'}
<script>
(() => {
  const send = (message) => window.ReactNativeWebView?.postMessage(JSON.stringify({ ...message, scrollY: window.scrollY || 0 }));
  const elementForNode = (node) => node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  const offsetWithin = (element, node, offset) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    try { range.setEnd(node, offset); } catch { return 0; }
    return range.toString().length;
  };
  const reportSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) { send({ type: 'dismiss-selection' }); return; }
    const range = selection.getRangeAt(0);
    const startVerse = elementForNode(range.startContainer)?.closest?.('.verse-text');
    const endVerse = elementForNode(range.endContainer)?.closest?.('.verse-text');
    const scripture = startVerse?.closest?.('.scripture');
    if (!startVerse || !endVerse || !scripture || endVerse.closest('.scripture') !== scripture) { send({ type: 'dismiss-selection' }); return; }
    const startOffset = Number(startVerse.dataset.start) + offsetWithin(startVerse, range.startContainer, range.startOffset);
    const endOffset = Number(endVerse.dataset.start) + offsetWithin(endVerse, range.endContainer, range.endOffset);
    const selectedText = selection.toString();
    if (!selectedText.trim() || endOffset <= startOffset) { send({ type: 'dismiss-selection' }); return; }
    send({ type: 'selection', chapterLabel: scripture.dataset.chapter, startOffset, endOffset, selectedText });
  };
  document.addEventListener('touchend', () => setTimeout(reportSelection, 30), { passive: true });
  document.addEventListener('mouseup', () => setTimeout(reportSelection, 10));
  document.addEventListener('contextmenu', (event) => event.preventDefault());
  document.addEventListener('click', (event) => {
    const mark = elementForNode(event.target)?.closest?.('mark[data-highlight-id]');
    if (mark) { event.preventDefault(); send({ type: 'open-highlight', id: mark.dataset.highlightId }); return; }
    setTimeout(() => { if (!window.getSelection()?.toString().trim()) send({ type: 'dismiss-selection' }); }, 0);
  });
  document.addEventListener('keydown', (event) => {
    const mark = elementForNode(event.target)?.closest?.('mark[data-highlight-id]');
    if (mark && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      send({ type: 'open-highlight', id: mark.dataset.highlightId });
    }
  });
  let scrollTimer = 0;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => send({ type: 'scroll' }), 120);
  }, { passive: true });
  send({ type: 'ready' });
})();
</script></body></html>`;
}
