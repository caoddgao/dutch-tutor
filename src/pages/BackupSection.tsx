import { Download, ShieldCheck, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { formatDateTime } from "../format";
import { useServices } from "../servicesContext";
import {
  backupErrorMessage,
  backupFileName,
  backupStamp,
  collectBackup,
  parseBackup,
  restoreBackup,
  serializeBackup,
  summarizeBackup,
  type BackupFile,
} from "../storage/backup";
import type { SqlDb } from "../storage/db";
import { writeCachedSettings } from "../storage/settingsStore";

const RESTORED_FLAG = "dutch-tutor.restored";

function readFlag(): boolean {
  try {
    return sessionStorage.getItem(RESTORED_FLAG) !== null;
  } catch {
    return false;
  }
}

function reloadApp() {
  window.location.reload();
}

type Notice = { kind: "success" | "error"; text: string } | null;

/** Settings → 学习数据: export one backup file, restore from one (design §8). */
export function BackupSection({ onRestored = reloadApp }: { onRestored?: () => void }) {
  const { db, settings: store, dataFiles } = useServices();
  const [busy, setBusy] = useState(false);
  // the page reloads after a restore; say so once it is back
  const [notice, setNotice] = useState<Notice>(() =>
    readFlag() ? { kind: "success", text: "已从备份恢复，学习进度和设置都换成了备份里的。" } : null,
  );
  const [pending, setPending] = useState<BackupFile | null>(null);

  useEffect(() => {
    try {
      sessionStorage.removeItem(RESTORED_FLAG);
    } catch {
      // storage unavailable: nothing to clear
    }
  }, []);

  const exportData = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const now = new Date();
      const backup = await collectBackup(await db(), store, now);
      const saved = await dataFiles.exportText(backupFileName(now), serializeBackup(backup), "保存学习数据备份");
      if (saved) setNotice({ kind: "success", text: "学习数据已导出。换电脑或重装后，用“从备份恢复”选这个文件即可。" });
    } catch {
      setNotice({ kind: "error", text: "导出没有成功，请换个保存位置再试一次。" });
    } finally {
      setBusy(false);
    }
  };

  const pickBackup = async () => {
    setNotice(null);
    let text: string | null;
    try {
      text = await dataFiles.importText("选择学习数据备份");
    } catch (err) {
      setNotice({ kind: "error", text: backupErrorMessage(err) });
      return;
    }
    if (text === null) return;
    try {
      setPending(parseBackup(text));
    } catch (err) {
      setNotice({ kind: "error", text: backupErrorMessage(err) });
    }
  };

  const restore = async () => {
    if (!pending) return;
    setBusy(true);
    setNotice(null);
    const now = new Date();
    let current: BackupFile;
    let d: SqlDb;
    try {
      d = await db();
      current = await collectBackup(d, store, now);
      await dataFiles.saveSafetyCopy(backupStamp(now), serializeBackup(current));
    } catch {
      setBusy(false);
      setNotice({ kind: "error", text: "没能先把当前数据另存一份，为了安全没有恢复。当前的学习数据没有变化。" });
      return;
    }
    try {
      await restoreBackup(d, store, pending);
    } catch {
      let back = true;
      try {
        await restoreBackup(d, store, current);
      } catch {
        back = false;
      }
      setBusy(false);
      setPending(null);
      setNotice({
        kind: "error",
        text: back
          ? "恢复没有完成，学习数据已经退回到恢复之前的样子。"
          : "恢复没有完成。恢复之前的数据已自动另存在程序的数据文件夹（backups）里，可以用“从备份恢复”选它再试一次。",
      });
      return;
    }
    writeCachedSettings(pending.settings);
    try {
      sessionStorage.setItem(RESTORED_FLAG, "1");
    } catch {
      // the notice after reloading is optional
    }
    setPending(null);
    setBusy(false);
    onRestored();
  };

  const summary = pending ? summarizeBackup(pending) : null;

  return (
    <section className="card settings-section" aria-label="学习数据">
      <h2 className="section-title">学习数据</h2>
      <div className="settings-row">
        <div className="settings-row-text">
          <div className="settings-row-label">备份与恢复</div>
          <div className="settings-row-desc">
            把学习进度、复习安排、测验成绩、设置、学习天数和报错记录存成一个文件。录音、资料包和发音评分的密钥不在里面。
          </div>
        </div>
        <div className="settings-actions">
          <button type="button" className="btn btn-primary btn-small" disabled={busy} onClick={exportData}>
            <Download size={15} aria-hidden />
            导出学习数据
          </button>
          <button type="button" className="btn btn-ghost btn-small" disabled={busy} onClick={pickBackup}>
            <Upload size={15} aria-hidden />
            从备份恢复
          </button>
        </div>
      </div>

      {summary && (
        <div className="restore-confirm" role="alertdialog" aria-label="确认恢复" aria-describedby="restore-desc">
          <div className="restore-confirm-head">
            <ShieldCheck size={20} aria-hidden />
            <strong>用这个备份覆盖当前的学习数据？</strong>
          </div>
          <p id="restore-desc">
            备份时间 {formatDateTime(summary.createdAt)}：学过 {summary.lessons} 课，{summary.reviewItems} 个复习项，
            {summary.studyDays} 个学习日，{summary.exams} 次测验成绩，{summary.reports} 条报错
            {summary.hardSentences === null ? "" : `，${summary.hardSentences} 句难句`}。
          </p>
          <p className="restore-confirm-note">
            恢复会覆盖当前的学习进度、复习、测验成绩、设置、学习天数
            {summary.hardSentences === null ? "和报错记录" : "、报错记录和难句"}
            ，录音不受影响。恢复前会自动把当前数据另存一份。
          </p>
          <div className="restore-confirm-actions">
            <button type="button" className="btn btn-ghost btn-small" disabled={busy} onClick={() => setPending(null)}>
              取消
            </button>
            <button type="button" className="btn btn-accent btn-small" disabled={busy} onClick={restore}>
              {busy ? "正在恢复…" : "覆盖并恢复"}
            </button>
          </div>
        </div>
      )}

      {notice && (
        <p className={`notice notice-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
          {notice.text}
        </p>
      )}
    </section>
  );
}
