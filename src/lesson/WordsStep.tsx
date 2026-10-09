import { AudioButton } from "../components/AudioButton";
import type { RtLesson, RtWord } from "../content/model";
import { WordEntry } from "./WordEntry";

/** Step ③: one word card per screen — the entry, the lesson's sentences that use it, its sound. */
export function WordsStep({ lesson, word, index }: { lesson: RtLesson; word: RtWord; index: number }) {
  const examples = lesson.sentences.filter((s) => s.tokens.some((t) => t.word_id === word.id));
  const isNew = lesson.newWordIds.includes(word.id);
  return (
    <div className="words-step">
      <div className="sentence-meta">
        <span className="sentence-count">
          第 {index + 1} / {lesson.words.length} 个词
        </span>
        {isNew && <span className="tag tag-recommended">新词</span>}
      </div>
      <WordEntry word={word} showPastParticiple={lesson.showPastParticiple} variant="card" />
      {examples.length > 0 && (
        <div className="word-examples">
          <h3 className="word-examples-title">本课例句</h3>
          <ul>
            {examples.slice(0, 4).map((s) => (
              <li key={s.id}>
                <AudioButton audio={s.audio} size="sm" label="播放例句" />
                <div>
                  <p className="nl" lang="nl">
                    {s.nl}
                  </p>
                  <p className="zh muted">{s.zh}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
