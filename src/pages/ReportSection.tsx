import { FileOutput } from "lucide-react";
import { useCallback, useContext, useEffect, useState } from "react";
import { Segmented } from "../components/Segmented";
import { ContentContext } from "../content/context";
import { buildCourseView } from "../content/model";
import { useServices } from "../servicesContext";
import {
  buildReportExport,
  markReportsExported,
  reportCounts,
  reportFileName,
  reportTable,
  type ReportCounts,
} from "../storage/feedback";
import { lessonNames } from "../storage/learningTables";
import { buildWorkbook } from "../storage/workbook";

type Notice = { kind: "success" | "error"; text: string } | null;
type Format = "json" | "xlsx";

/**
 * Settings → 内容报错: how many reports wait, and one file with them for the next revision (design §7),
 * as JSON or as an Excel table (decision 29).
 */
export function ReportSection() {
  const { db, dataFiles, content } = useServices();
  const course = useContext(ContentContext)?.course;
  const [format, setFormat] = useState<Format>("json");
  const [counts, setCounts] = useState<ReportCounts | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const refresh = useCallback(
    () =>
      db()
        .then(reportCounts)
        .then(setCounts)
        .catch(() => setCounts({ total: 0, unexported: 0 })),
    [db],
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const all = !!counts && counts.unexported === 0 && counts.total > 0;

  const exportReports = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const d = await db();
      const now = new Date();
      const { file, ids } = await buildReportExport(d, all, now);
      const saved =
        format === "json"
          ? await dataFiles.exportText(reportFileName(now), JSON.stringify(file, null, 2), "保存内容报错")
          : await dataFiles.exportWorkbook(
              reportFileName(now, "xlsx"),
              await buildWorkbook([reportTable(file, lessonNames(content, course ?? buildCourseView(content, null)))]),
              "保存内容报错",
            );
      if (saved) {
        await markReportsExported(d, ids, now);
        setNotice({ kind: "success", text: `已导出 ${ids.length} 条报错。把这个文件交给负责修订内容的人即可。` });
      }
    } catch {
      setNotice({ kind: "error", text: "导出没有成功，请换个保存位置再试一次。" });
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  return (
    <section className="card settings-section" aria-label="内容报错">
      <h2 className="section-title">内容报错</h2>
      <div className="settings-row">
        <div className="settings-row-text">
          <div className="settings-row-label">
            {counts === null
              ? "正在统计…"
              : counts.total === 0
                ? "还没有报错"
                : counts.unexported > 0
                  ? `${counts.unexported} 条还没导出`
                  : `${counts.total} 条都已导出`}
          </div>
          <div className="settings-row-desc">
            上课和复习时，句卡、词卡上的“报错”会记在这里。导出成 JSON 文件或 Excel 表格，内容会在下次更新时统一修订。
          </div>
        </div>
        <div className="settings-actions">
          <Segmented<Format>
            label="导出格式"
            value={format}
            onChange={setFormat}
            options={[
              { value: "json", label: "JSON" },
              { value: "xlsx", label: "Excel 表格" },
            ]}
          />
          <button
            type="button"
            className="btn btn-primary btn-small"
            disabled={busy || !counts || counts.total === 0}
            onClick={exportReports}
          >
            <FileOutput size={15} aria-hidden />
            {all ? "重新导出全部" : "导出报错"}
          </button>
        </div>
      </div>
      {notice && (
        <p className={`notice notice-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
          {notice.text}
        </p>
      )}
    </section>
  );
}
