import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { Segmented } from "../components/Segmented";
import { PackSection } from "./PackSection";
import { useSettings } from "../settings/context";
import {
  DEFAULT_SETTINGS,
  formatPercent,
  SCALE_MAX,
  SCALE_MIN,
  SCALE_STEP,
  type Settings,
  type ThemePreference,
} from "../settings/settings";
import "./SettingsPage.css";

type ScaleKey = "scaleNl" | "scaleZh" | "scaleEn";

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

      <PackSection />

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
