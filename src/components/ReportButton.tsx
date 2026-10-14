import { Check, Flag, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useServices } from "../servicesContext";
import { addReport, NOTE_MAX, REPORT_CATEGORIES, type ReportCategory, type ReportTarget } from "../storage/feedback";
import "./ReportButton.css";

/** A quiet "报错" button for a sentence or word card (design §7); the report is kept for export. */
export function ReportButton({ target }: { target: ReportTarget }) {
  const [open, setOpen] = useState(false);
  const [sentFor, setSentFor] = useState<string | null>(null);
  const key = `${target.type}:${target.id}`;
  const sent = sentFor === key;

  return (
    <>
      <button
        type="button"
        className={`report-btn${sent ? " is-sent" : ""}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        title={sent ? "已报错，可以再补充" : "这里有错？告诉我们"}
      >
        {sent ? <Check size={13} aria-hidden /> : <Flag size={13} aria-hidden />}
        {sent ? "已报错" : "报错"}
      </button>
      {open && (
        <ReportDialog
          target={target}
          onClose={() => setOpen(false)}
          onSent={() => {
            setSentFor(key);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function ReportDialog({ target, onClose, onSent }: { target: ReportTarget; onClose: () => void; onSent: () => void }) {
  const { db } = useServices();
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  // focus moves into the dialog and back to the button afterwards
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("input[type=radio]")?.focus();
    return () => previous?.focus?.();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) return;
    setSaving(true);
    setError(false);
    try {
      await addReport(await db(), target, category, note);
      onSent();
    } catch {
      setError(true);
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="report-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      // keys stay inside the dialog: the lesson page's arrow / space shortcuts must not act behind it
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="report-dialog card" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panel}>
        <div className="report-head">
          <h2 id={titleId} className="section-title">
            报告内容问题
          </h2>
          <button type="button" className="report-close" aria-label="关闭" onClick={onClose}>
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="report-target">
          <span className="tag tag-new">{target.type === "word" ? "词" : "句子"}</span>
          <p className="nl" lang="nl">
            {target.nl}
          </p>
          <p className="zh muted">{target.zh}</p>
        </div>
        <form onSubmit={submit} className="report-form">
          <fieldset className="report-reasons">
            <legend>哪里不对？</legend>
            {REPORT_CATEGORIES.map((c) => (
              <label key={c.value} className="report-reason" data-checked={category === c.value || undefined}>
                <input
                  type="radio"
                  name="report-reason"
                  value={c.value}
                  checked={category === c.value}
                  onChange={() => setCategory(c.value)}
                />
                {c.label}
              </label>
            ))}
          </fieldset>
          <label className="report-note">
            <span>补充说明（可不填）</span>
            <textarea
              value={note}
              maxLength={NOTE_MAX}
              rows={3}
              placeholder="例如：中文应该是……"
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          {error && (
            <p className="notice notice-error" role="alert">
              没有记下来，请再点一次“提交”。
            </p>
          )}
          <div className="report-actions">
            <button type="button" className="btn btn-ghost btn-small" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn btn-primary btn-small" disabled={!category || saving}>
              {saving ? "正在保存…" : "提交"}
            </button>
          </div>
          <p className="report-hint muted">报错会先存在本机，可在“设置 → 内容报错”里一起导出。</p>
        </form>
      </div>
    </div>,
    document.body,
  );
}
