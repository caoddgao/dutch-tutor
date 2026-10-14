import { isTauri } from "@tauri-apps/api/core";
import { useState } from "react";
import { azureErrorMessage, useAzure } from "../pronunciation/context";
import { ProgressBar } from "../components/ProgressBar";

export function AzureSection() {
  const { status, loadError, save, clearKey, testConnection } = useAzure();
  const [draft, setDraft] = useState({ base: "", region: "" });
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const region = draft.base === status?.region ? draft.region : (status?.region ?? "");
  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage(success);
    } catch (error) {
      setMessage(azureErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card settings-section" aria-label="发音评分">
      <h2 className="section-title">发音评分</h2>
      <p className="settings-row-desc">
        可选。录完口语后查看准确度、流利度、完整度、总分和需要多练的词。评分需要联网，会使用你的 Azure 语音额度。
      </p>
      {!isTauri() ? (
        <p className="settings-row-desc">请在已安装的程序里设置发音评分。</p>
      ) : !status ? (
        <p className="settings-row-desc">
          {loadError ? "评分设置读取失败，请重新打开程序后再试。" : "正在读取评分设置……"}
        </p>
      ) : (
        <>
          <label className="azure-field">
            Azure 区域
            <input
              value={region}
              onChange={(e) => setDraft({ base: status.region, region: e.target.value })}
              placeholder="例如 westeurope"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className="azure-field">
            Azure 密钥
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={status.has_key ? "已保存；留空则保持不变" : "粘贴密钥"}
              autoComplete="new-password"
            />
          </label>
          <div className="azure-actions">
            <button
              type="button"
              className="btn btn-primary btn-small"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await save(region, key, status.enabled);
                  setKey("");
                }, "设置已保存在这台电脑上。")
              }
            >
              保存设置
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              disabled={busy || !status.has_key}
              onClick={() => void run(testConnection, "连接成功，可以开启发音评分。")}
            >
              测试连接
            </button>
            {status.has_key && (
              <button
                type="button"
                className="btn btn-ghost btn-small"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await clearKey();
                    setKey("");
                  }, "密钥已清除。")
                }
              >
                清除密钥
              </button>
            )}
          </div>
          <div className="settings-row">
            <div className="settings-row-text">
              <div className="settings-row-label">开启发音评分</div>
              <div className="settings-row-desc">开启后，口语录音旁会出现“发音评分”按钮；每次由你决定是否评分。</div>
            </div>
            <button
              type="button"
              className="switch"
              role="switch"
              aria-checked={status.enabled}
              aria-label="开启发音评分"
              disabled={busy || !status.has_key}
              onClick={() =>
                void run(
                  () => save(region, "", !status.enabled),
                  status.enabled ? "发音评分已关闭。" : "发音评分已开启。",
                )
              }
            />
          </div>
          <div className="azure-usage">
            <span>
              本程序本月送评约{" "}
              {status.month_seconds > 0 && status.month_seconds < 6
                ? "不足 0.1"
                : (status.month_seconds / 60).toFixed(1)}{" "}
              / 300 分钟
            </span>
            <ProgressBar value={status.month_seconds / (300 * 60)} label="本月发音评分用量" />
            <small>Azure 免费额度每月共 5 小时；这里仅统计本程序</small>
          </div>
          {message && (
            <p className="recording-message" role="status">
              {message}
            </p>
          )}
        </>
      )}
    </section>
  );
}
