import type { RecordingItem } from "./catalog";

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Generated on the learner's computer. No book text or transcript is checked into the repository. */
export function transcriptHtml(title: string, items: RecordingItem[]): string {
  const rows = items
    .map(
      (item, index) =>
        `<tr><td class="number">${String(index + 1).padStart(2, "0")}</td><td><strong>${escapeHtml(item.nl)}</strong><span>${escapeHtml(item.zh)}</span></td><td>${item.origin === "book" ? "原书" : "我们写的"} · ${item.kind === "word" ? "词" : "句子"}</td><td class="mark">□</td></tr>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(title)} · 录音稿</title>
<style>
@page{size:A4;margin:15mm}*{box-sizing:border-box}body{font-family:"Microsoft YaHei","Noto Sans SC",sans-serif;color:#17213b;margin:0}
h1{font-size:22px;margin:0 0 6px}.lead{color:#526075;font-size:12px;margin:0 0 16px}
table{border-collapse:collapse;width:100%;font-size:12px}th{text-align:left;background:#edf1f8;color:#243e78}
td,th{border-bottom:1px solid #dbe1ec;padding:7px 9px;vertical-align:top}tr{break-inside:avoid;page-break-inside:avoid}
td.number{width:38px;color:#526075;font-weight:700}td span{display:block;color:#526075;margin-top:3px}td:nth-child(3){width:90px;white-space:nowrap;color:#526075}
td.mark{width:38px;font-size:18px;color:#526075}strong{font-size:14px;font-weight:600}
</style></head><body><h1>${escapeHtml(title)} · 录音稿</h1><p class="lead">先读一遍，觉得别扭的句子在最后一栏做记号，再到录音模式中标记“这句不自然”。请按编号顺序录音。</p>
<table><thead><tr><th>编号</th><th>荷兰语 / 中文</th><th>来源</th><th>标记</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}
