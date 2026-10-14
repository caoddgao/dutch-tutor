import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Segmented } from "../components/Segmented";
import { PackSection } from "./PackSection";
import { AzureSection } from "./AzureSection";
import { BackupSection } from "./BackupSection";
import { ReportSection } from "./ReportSection";
import { useSettings } from "../settings/context";
import {
  DEFAULT_SETTINGS,
  formatPercent,
  REVIEW_LIMIT_MAX,
  REVIEW_LIMIT_MIN,
  REVIEW_LIMIT_STEP,
  SCALE_MAX,
  SCALE_MIN,
  SCALE_STEP,
  type Settings,
  type ThemePreference,
} from "../settings/settings";
import "./SettingsPage.css";

type ScaleKey = "scaleNl" | "scaleZh" | "scaleEn";

const REVIEW_MODES: { key: "reviewR1" | "reviewR2" | "reviewR3"; label: string; desc: string }[] = [
  { key: "reviewR1", label: "R1 看荷兰语选意思", desc: "显示荷兰语，从 4 个意思里选。" },
  { key: "reviewR2", label: "R2 只听不看选意思", desc: "只播放录音，不显示文字。" },
  {
    key: "reviewR3",
    label: "R3 看中文说荷兰语",
    desc: "看中文（和英文）开口说，再听原声对比，自己评“会 / 模糊 / 不会”。",
  },
];

const SCALES: { key: ScaleKey; label: string }[] = [
  { key: "scaleNl", label: "荷兰语" },
  { key: "scaleZh", label: "中文" },
  { key: "scaleEn", label: "英文" },
];

export function SettingsPage() {
  const { settings, update } = useSettings();
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    getVersion()
      .then(setVersion)
      .catch(() => setVersion(null));
  }, []);

  const scalesAreDefault = SCALES.every(({ key }) => settings[key] === DEFAULT_SETTINGS[key]);

  return (
    <div className="settings">
      <section className="card settings-section">
        <h2 className="section-title">外观</h2>
        <div className="settings-row">
          <div className="settings-row-text">
            <div className="settings-row-label">主题</div>
            <div className="settings-row-desc">跟随系统时，会随 Windows 的浅色 / 深色模式自动切换。</div>
          </div>
          <Segmented<ThemePreference>
            label="主题"
            value={settings.theme}
            onChange={(v) => update("theme", v)}
            options={[
              { value: "light", label: "浅色" },
              { value: "dark", label: "深色" },
              { value: "system", label: "跟随系统" },
            ]}
          />
        </div>
      </section>

      <section className="card settings-section">
        <div className="settings-section-head">
          <h2 className="section-title">字号</h2>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            disabled={scalesAreDefault}
            onClick={() => SCALES.forEach(({ key }) => update(key, DEFAULT_SETTINGS[key]))}
          >
            恢复默认
          </button>
        </div>
        <div className="scale-list">
          {SCALES.map(({ key, label }) => (
            <ScaleSlider key={key} label={label} value={settings[key]} onChange={(v) => update(key, v)} />
          ))}
        </div>
        <div className="scale-preview" aria-label="字号预览">
          <p className="nl nl-sentence">Ik woon in Amsterdam.</p>
          <p className="zh scale-preview-zh">我住在阿姆斯特丹。</p>
          <p className="en scale-preview-en">I live in Amsterdam.</p>
        </div>
      </section>

      <section className="card settings-section">
        <h2 className="section-title">英文释义</h2>
        <div className="settings-row">
          <div className="settings-row-text">
            <div className="settings-row-label">显示英文释义</div>
            <div className="settings-row-desc">关闭后，所有页面只显示荷兰语和中文。顶栏的"EN"按钮也可以随时切换。</div>
          </div>
          <button
            type="button"
            className="switch"
            role="switch"
            aria-checked={settings.showEnglish}
            aria-label="显示英文释义"
            onClick={() => update("showEnglish", !settings.showEnglish)}
          />
        </div>
      </section>

      <section className="card settings-section">
        <h2 className="section-title">播放</h2>
        <div className="settings-row">
          <div className="settings-row-text">
            <div className="settings-row-label">默认播放速度</div>
            <div className="settings-row-desc">慢速播放时音调不变。上课时也可以随时切换。</div>
          </div>
          <Segmented<number>
            label="默认播放速度"
            value={settings.playbackRate}
            onChange={(v) => update("playbackRate", v as Settings["playbackRate"])}
            options={[
              { value: 1, label: "正常 1.0×" },
              { value: 0.75, label: "慢速 0.75×" },
            ]}
          />
        </div>
      </section>

      <section className="card settings-section" aria-label="复习">
        <h2 className="section-title">复习</h2>
        <div className="settings-row">
          <div className="settings-row-text">
            <div className="settings-row-label">每日复习上限</div>
            <div className="settings-row-desc">“今日复习”每天最多出这么多项，到期但超出的留到第二天。</div>
          </div>
        </div>
        <label className="scale-row">
          <span className="scale-label">上限</span>
          <input
            type="range"
            className="slider"
            min={REVIEW_LIMIT_MIN}
            max={REVIEW_LIMIT_MAX}
            step={REVIEW_LIMIT_STEP}
            value={settings.dailyReviewLimit}
            aria-label="每日复习上限"
            style={
              {
                "--fill": `${((settings.dailyReviewLimit - REVIEW_LIMIT_MIN) / (REVIEW_LIMIT_MAX - REVIEW_LIMIT_MIN)) * 100}%`,
              } as React.CSSProperties
            }
            onChange={(e) => update("dailyReviewLimit", Number(e.target.value))}
          />
          <span className="scale-value">{settings.dailyReviewLimit} 项</span>
        </label>
        {REVIEW_MODES.map(({ key, label, desc }) => {
          const onCount = REVIEW_MODES.filter((m) => settings[m.key]).length;
          const locked = settings[key] && onCount === 1;
          return (
            <div key={key} className="settings-row">
              <div className="settings-row-text">
                <div className="settings-row-label">{label}</div>
                <div className="settings-row-desc">{locked ? `${desc}（至少保留一种方式）` : desc}</div>
              </div>
              <button
                type="button"
                className="switch"
                role="switch"
                aria-checked={settings[key]}
                aria-label={label}
                disabled={locked}
                onClick={() => update(key, !settings[key])}
              />
            </div>
          );
        })}
      </section>

      <PackSection />

      <AzureSection />

      <section className="card settings-section">
        <h2 className="section-title">真人录音</h2>
        <div className="settings-row">
          <div className="settings-row-text">
            <div className="settings-row-label">录音模式</div>
            <div className="settings-row-desc">
              按课录制句子和词，保存后自动替换播放音源。也可以导出录音稿和录音文件夹。
            </div>
          </div>
          <Link className="btn btn-primary btn-small" to="/settings/recording">
            进入录音模式
          </Link>
        </div>
      </section>

      <BackupSection />

      <ReportSection />

      <section className="card settings-section">
        <h2 className="section-title">关于</h2>
        <div className="settings-row">
          <div className="settings-row-text">
            <div className="settings-row-label">Dutch Tutor</div>
            <div className="settings-row-desc">荷兰语 A1 自学，以 Naar Nederland 为主干。</div>
          </div>
          {version && <span className="settings-version">版本 {version}</span>}
        </div>
      </section>
    </div>
  );
}

function ScaleSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const fill = ((value - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;
  return (
    <label className="scale-row">
      <span className="scale-label">{label}</span>
      <input
        type="range"
        className="slider"
        min={SCALE_MIN}
        max={SCALE_MAX}
        step={SCALE_STEP}
        value={value}
        aria-label={`${label}字号`}
        style={{ "--fill": `${fill}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="scale-value">{formatPercent(value)}</span>
    </label>
  );
}
