import { isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { BookOpen, Download, Mic, Play, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { useAudio } from "../audio/context";
import { player } from "../audio/player";
import {
  recorderErrorMessage,
  RecorderError,
  startRecording,
  type ActiveRecording,
  type Recording,
} from "../audio/recorder";
import { useContent } from "../content/context";
import type { PackLesson } from "../content/packTypes";
import { examRecordingItems, lessonRecordingItems, packRecordingItems, type RecordingItem } from "../recording/catalog";
import { transcriptHtml } from "../recording/transcript";
import "./RecordingPage.css";

type LessonOption = { id: string; label: string; mode: "course" | "book" | "exam" };

export function RecordingPage() {
  const { bundle, course, dict, packIndex, packStatus, backend, loadLesson } = useContent();
  const { resolve, recordings, refreshVoice } = useAudio();
  const options = useMemo<LessonOption[]>(
    () => [
      ...course.flatMap((section) =>
        section.lessons.map((lesson) => ({
          id: lesson.id,
          label: `${lesson.code} · ${lesson.title?.zh ?? ""}`,
          mode: "course" as const,
        })),
      ),
      ...(packIndex?.lessons ?? [])
        .filter((lesson) => /^NN(?:0[1-9]|1\d|20)$/.test(lesson.id))
        .map((lesson) => ({
          id: lesson.id,
          label: `原书第 ${Number(lesson.id.slice(2))} 课 · ${lesson.title.zh}`,
          mode: "book" as const,
        })),
      ...Object.values(bundle.exams ?? {}).map((exam) => ({
        id: exam.id,
        label: exam.title.zh,
        mode: "exam" as const,
      })),
    ],
    [bundle, course, packIndex],
  );
  const [selected, setSelected] = useState(options[0]?.id ?? "");
  const option = useMemo(() => options.find((x) => x.id === selected) ?? options[0], [options, selected]);
  const [loaded, setLoaded] = useState<{ key: string; items: RecordingItem[] }>({ key: "", items: [] });
  const key = option ? `${option.mode}:${option.id}` : "";
  const loading = !!option && loaded.key !== key;
  const items = loaded.key === key ? loaded.items : [];
  const [unrecorded, setUnrecorded] = useState(false);
  const [voiceIds, setVoiceIds] = useState<Set<string>>(new Set());
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!option) return;
    (async () => {
      let result: RecordingItem[] = [];
      if (option.mode === "course") {
        const lesson = await loadLesson(option.id);
        if (lesson) result = lessonRecordingItems(lesson, bundle);
      } else if (option.mode === "book") {
        const pack = JSON.parse(await backend.readText(`lessons/${option.id}.json`)) as PackLesson;
        result = packRecordingItems(pack, dict, bundle);
      } else result = examRecordingItems(bundle);
      if (!cancelled) setLoaded({ key: `${option.mode}:${option.id}`, items: result });
    })().catch(() => {
      if (!cancelled) {
        setLoaded({ key: `${option.mode}:${option.id}`, items: [] });
        setMessage("这一课暂时无法读取，请重新导入资料包后再试。");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [option, loadLesson, backend, dict, bundle]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([recordings.voiceUrls(), recordings.unnaturalIds()])
      .then(([voices, marks]) => {
        if (!cancelled) {
          setVoiceIds(new Set(voices.keys()));
          setMarked(marks);
        }
      })
      .catch(() => setMessage("录音记录暂时无法读取，请稍后再试。"));
    return () => {
      cancelled = true;
    };
  }, [recordings]);

  const shown = unrecorded ? items.filter((item) => !voiceIds.has(item.id)) : items;
  const count = items.filter((item) => voiceIds.has(item.id)).length;
  const changeMark = async (item: RecordingItem) => {
    try {
      await recordings.markUnnatural(item.id, item.kind, !marked.has(item.id));
      setMarked((old) => {
        const next = new Set(old);
        if (next.has(item.id)) next.delete(item.id);
        else next.add(item.id);
        return next;
      });
    } catch {
      setMessage("标记没有保存成功，请再试一次。");
    }
  };

  const chooseFolder = async (title: string) => {
    if (!isTauri()) {
      setMessage("请在已安装的程序里导出或导入文件夹。");
      return null;
    }
    const picked = await open({ directory: true, multiple: false, title });
    return typeof picked === "string" ? picked : null;
  };
  const exportFolder = async () => {
    const path = await chooseFolder("选择保存录音的文件夹");
    if (!path) return;
    setBusy(true);
    try {
      await recordings.exportFolder(path);
      setMessage("录音和标记已导出到所选文件夹。");
    } catch {
      setMessage("导出失败，请检查文件夹是否可写。");
    } finally {
      setBusy(false);
    }
  };
  const importFolder = async () => {
    const path = await chooseFolder("选择要导入的录音文件夹");
    if (!path) return;
    setBusy(true);
    try {
      await recordings.importFolder(path);
      setVoiceIds(new Set((await recordings.voiceUrls()).keys()));
      setMarked(await recordings.unnaturalIds());
      await refreshVoice();
      setMessage("录音和标记已导入，可以在课程里播放。");
    } catch {
      setMessage("导入失败，请选择由本程序导出的录音文件夹。");
    } finally {
      setBusy(false);
    }
  };
  const exportTranscript = async () => {
    if (!option || !items.length) return;
    if (!isTauri()) {
      setMessage("请在已安装的程序里导出录音稿。");
      return;
    }
    const path = await save({
      title: "保存录音稿",
      defaultPath: `${option.id}-录音稿.html`,
      filters: [{ name: "网页文件", extensions: ["html"] }],
    });
    if (!path) return;
    setBusy(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("write_recording_transcript", { path, html: transcriptHtml(option.label, items) });
      setMessage("录音稿已保存，可以用浏览器打开并打印。");
    } catch {
      setMessage("录音稿保存失败，请换个位置再试。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="recording-page">
      <section className="immersive recording-hero">
        <div className="recording-hero-icon">
          <Mic size={26} aria-hidden />
        </div>
        <div>
          <p className="recording-eyebrow">真人配音</p>
          <h2>录音模式</h2>
          <p>先导出每课录音稿，读一遍并标记别扭的句子。按课逐句录、回放，满意后保存；保存的声音会自动用在课程里。</p>
        </div>
      </section>
      <section className="card recording-controls">
        <div className="recording-controls-top">
          <div>
            <h2 className="section-title">录音清单</h2>
            <p>选择一课，再从上到下录制。</p>
          </div>
          <Link className="btn btn-ghost btn-small" to="/settings">
            返回设置
          </Link>
        </div>
        <div className="recording-toolbar">
          <label className="recording-lesson-select">
            课程
            <select
              value={option?.id ?? ""}
              onChange={(e) => {
                player.stop();
                setSelected(e.target.value);
                setMessage("");
              }}
            >
              {options.map((x) => (
                <option key={`${x.mode}-${x.id}`} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => void exportTranscript()}
            disabled={!items.length || busy}
          >
            <BookOpen size={16} />
            导出录音稿
          </button>
          <button type="button" className="btn btn-ghost btn-small" onClick={() => void exportFolder()} disabled={busy}>
            <Download size={16} />
            导出录音
          </button>
          <button type="button" className="btn btn-ghost btn-small" onClick={() => void importFolder()} disabled={busy}>
            <Upload size={16} />
            导入录音
          </button>
        </div>
        <div className="recording-progress">
          <span>
            {count} / {items.length} 已录
          </span>
          <div className="recording-progress-track">
            <span style={{ width: `${items.length ? (count / items.length) * 100 : 0}%` }} />
          </div>
          <label className="recording-filter">
            <input type="checkbox" checked={unrecorded} onChange={(e) => setUnrecorded(e.target.checked)} />
            只看未录的
          </label>
        </div>
        {message && (
          <p className="recording-message" role="status">
            {message}
          </p>
        )}
      </section>
      {loading ? (
        <div className="card recording-empty">正在读取句子和词……</div>
      ) : !items.length ? (
        <div className="card recording-empty">
          {packStatus === "ready" ? "这一课没有可录的句子或词。" : "导入资料包后，原书的句子和词会出现在这里。"}
        </div>
      ) : shown.length === 0 ? (
        <div className="card recording-empty">这课的录音已全部完成。取消筛选可以查看全部。</div>
      ) : (
        <div className="recording-list">
          {shown.map((item, i) => (
            <RecordingRow
              key={item.id}
              item={item}
              number={items.indexOf(item) + 1 || i + 1}
              source={resolve(item.audio)}
              recorded={voiceIds.has(item.id)}
              marked={marked.has(item.id)}
              onMark={() => void changeMark(item)}
              onSaved={async () => {
                setVoiceIds((old) => new Set(old).add(item.id));
                await refreshVoice();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface RowProps {
  item: RecordingItem;
  number: number;
  source: ReturnType<ReturnType<typeof useAudio>["resolve"]>;
  recorded: boolean;
  marked: boolean;
  onMark(): void;
  onSaved(): Promise<void>;
}

function RecordingRow({ item, number, source, recorded, marked, onMark, onSaved }: RowProps) {
  const { recordings } = useAudio();
  const [draft, setDraft] = useState<Recording | null>(null);
  const [draftUrl, setDraftUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "recording" | "saving">("idle");
  const [error, setError] = useState("");
  const active = useRef<ActiveRecording | null>(null);
  useEffect(
    () => () => {
      active.current?.cancel();
      if (draftUrl) URL.revokeObjectURL(draftUrl);
    },
    [draftUrl],
  );
  const toggleRecord = async () => {
    setError("");
    player.stop();
    if (active.current) {
      const current = active.current;
      active.current = null;
      const result = await current.stop();
      if (draftUrl) URL.revokeObjectURL(draftUrl);
      setDraft(result);
      setDraftUrl(URL.createObjectURL(result.blob));
      setState("idle");
    } else {
      try {
        active.current = await startRecording();
        setState("recording");
      } catch (e) {
        setError(recorderErrorMessage(e instanceof RecorderError ? e.code : "unsupported"));
      }
    }
  };
  const saveDraft = async () => {
    if (!draft) return;
    setState("saving");
    try {
      await recordings.saveVoice(item.id, draft);
      await onSaved();
      setDraft(null);
      setState("idle");
    } catch {
      setError("录音没有保存成功，请再试一次。");
      setState("idle");
    }
  };
  const sourceLabel = recorded
    ? "真人录音"
    : source?.source === "nn"
      ? "原书录音"
      : source?.source === "tts"
        ? "合成音"
        : "暂无音源";
  return (
    <article className="card recording-row">
      <div className="recording-row-number">{String(number).padStart(2, "0")}</div>
      <div className="recording-row-main">
        <div className="recording-badges">
          <span>{item.kind === "word" ? "词" : "句子"}</span>
          <span>{item.origin === "book" ? "原书" : "我们写的"}</span>
          <span className={recorded ? "recording-source voice" : "recording-source"}>{sourceLabel}</span>
        </div>
        <p className="recording-nl">{item.nl}</p>
        <p className="recording-zh">{item.zh || "（暂无中文释义）"}</p>
        <div className="recording-row-actions">
          <button
            type="button"
            className="btn btn-ghost btn-small"
            disabled={!source || state === "recording"}
            onClick={() => source && void player.play(source.url)}
          >
            <Play size={15} />
            听当前音源
          </button>
          <button
            type="button"
            className={`btn btn-small ${state === "recording" ? "btn-accent" : "btn-primary"}`}
            disabled={state === "saving"}
            onClick={() => void toggleRecord()}
          >
            <Mic size={15} />
            {state === "recording" ? "停止录音" : "录这一句"}
          </button>
          {draftUrl && (
            <button type="button" className="btn btn-ghost btn-small" onClick={() => void player.play(draftUrl)}>
              <Play size={15} />
              回放
            </button>
          )}
          {draft && (
            <button
              type="button"
              className="btn btn-accent btn-small"
              disabled={state === "saving"}
              onClick={() => void saveDraft()}
            >
              {state === "saving" ? "保存中…" : "满意，保存"}
            </button>
          )}
          <label className="recording-mark">
            <input type="checkbox" checked={marked} onChange={onMark} />
            这句不自然
          </label>
        </div>
        {error && (
          <p className="recording-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </article>
  );
}
