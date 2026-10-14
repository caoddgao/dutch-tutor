import { FolderOpen, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useContent } from "../content/context";
import { formatDateTime } from "../format";
import { packErrorMessage } from "../pack/backend";

/** Settings → 资料包: import, re-import, where it lives (design §8, §9). */
export function PackSection() {
  const { backend, packStatus, packInfo, packIndex, packUpdate, importPack } = useContent();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const run = async (dir: string | null) => {
    if (!dir) return;
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await importPack(dir);
      setDone(true);
    } catch (err) {
      setError(packErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const pickAndImport = async () => run(await backend.pickFolder());
  const lessons = packIndex?.lessons.length ?? 0;
  const installed = packStatus === "ready" && packInfo?.manifest;
  const broken = packStatus === "outdated" || packStatus === "error";

  return (
    <section className="card settings-section" aria-label="资料包">
      <h2 className="section-title">Naar Nederland 资料包</h2>
      <div className="settings-row">
        <div className="settings-row-text">
          {installed ? (
            <>
              <div className="settings-row-label">已导入 · {lessons} 课</div>
              <div className="settings-row-desc">
                资料包生成于 {formatDateTime(packInfo.manifest!.created_at)}
                {packInfo.imported_at && `，导入于 ${formatDateTime(packInfo.imported_at)}`}
              </div>
            </>
          ) : broken ? (
            <>
              <div className="settings-row-label">资料包需要重新导入</div>
              <div className="settings-row-desc">
                {packStatus === "outdated"
                  ? "已导入的资料包和现在的程序不配套。请选择新整理的资料包文件夹（nn-pack）重新导入。"
                  : "已导入的资料包不完整或已损坏，读不出来。请选择资料包文件夹（nn-pack）重新导入。"}
              </div>
            </>
          ) : (
            <>
              <div className="settings-row-label">{packStatus === "loading" ? "正在读取…" : "还没有导入"}</div>
              <div className="settings-row-desc">
                正课（第 21 课起）的课文、原版录音和练习都在资料包里。选择整理好的 nn-pack 文件夹即可导入，只需一次。
              </div>
            </>
          )}
        </div>
        {backend.canImport && (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={pickAndImport}>
            <FolderOpen size={16} aria-hidden />
            {busy ? "正在导入…" : installed || broken ? "重新导入" : "导入资料包"}
          </button>
        )}
      </div>

      {packUpdate && packInfo?.source_dir && (
        <div className="notice notice-accent" role="status">
          <span>资料包有新版本（生成于 {formatDateTime(packUpdate)}），重新导入后才能看到新内容。</span>
          <button
            type="button"
            className="btn btn-accent btn-small"
            disabled={busy}
            onClick={() => run(packInfo.source_dir)}
          >
            <RefreshCw size={14} aria-hidden />
            重新导入
          </button>
        </div>
      )}
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      {done && !error && (
        <p className="notice notice-success" role="status">
          导入完成。
        </p>
      )}
      {installed && backend.canImport && <p className="settings-path">位置：{packInfo.dir}</p>}
    </section>
  );
}
