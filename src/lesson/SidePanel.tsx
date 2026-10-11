import { Lightbulb, MousePointerClick } from "lucide-react";
import type { RtLesson, RtWord } from "../content/model";
import { WordEntry } from "./WordEntry";

interface Props {
  lesson: RtLesson;
  word: RtWord | null;
  /** false on the word-card step, where the card itself is the entry */
  showWord?: boolean;
  /** Grapheme to explain in a phonics lesson (the sound of the current keyword) */
  soundHint?: string | null;
  onOpenTips?: () => void;
}

/** Right column: the entry of the clicked word, and the orange "小贴士" card. */
export function SidePanel({ lesson, word, showWord = true, soundHint, onOpenTips }: Props) {
  const sound = lesson.sounds.find((s) => s.grapheme === soundHint) ?? lesson.sounds[0];
  const tip = lesson.tips[0] ?? lesson.tipLinks[0];
  return (
    <aside className="lesson-side" aria-label="词条和小贴士">
      {showWord && (
        <section className="card word-panel" aria-label="词条">
          {word ? (
            <WordEntry word={word} showPastParticiple={lesson.showPastParticiple} />
          ) : (
            <div className="word-panel-empty">
              <MousePointerClick size={22} aria-hidden />
              <p>点句子里的任意词，这里显示它的词条：原形、词性、变化和释义。</p>
            </div>
          )}
        </section>
      )}
      <section className="tip-card" aria-label="小贴士">
        <div className="tip-card-head">
          <Lightbulb size={18} aria-hidden />
          <span>小贴士</span>
        </div>
        {lesson.kind === "phonics" && sound ? (
          <>
            <p className="tip-card-title">
              <span className="nl tip-grapheme">{sound.grapheme}</span>
            </p>
            <p className="tip-card-body">{sound.noteZh}</p>
            {sound.noteEn && <p className="en tip-card-en">{sound.noteEn}</p>}
          </>
        ) : tip ? (
          <>
            <p className="tip-card-title">{tip.title.zh}</p>
            <p className="tip-card-body">{tip.bodyZh[0]}</p>
            {onOpenTips && (
              <button type="button" className="tip-card-link" onClick={onOpenTips}>
                看完整说明
              </button>
            )}
          </>
        ) : (
          <p className="tip-card-body">
            先听原声，再点“跟读”录下自己的声音，用“交替”和原声对比。0.75× 慢放时音调不变。
          </p>
        )}
      </section>
    </aside>
  );
}
