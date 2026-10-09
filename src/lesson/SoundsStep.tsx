import { AudioButton } from "../components/AudioButton";
import type { RtLesson } from "../content/model";

/** Phonics step "音": each sound group with its explanation and keywords (design §2.1, §3). */
export function SoundsStep({ lesson }: { lesson: RtLesson }) {
  const words = new Map(lesson.words.map((w) => [w.id, w]));
  return (
    <div className="sounds-step">
      {lesson.sounds.map((s) => (
        <article key={s.grapheme} className="sound-card">
          <div className="sound-grapheme nl" lang="nl">
            {s.grapheme}
          </div>
          <div className="sound-body">
            <p className="sound-note">{s.noteZh}</p>
            {s.noteEn && <p className="en">{s.noteEn}</p>}
            <ul className="sound-keywords">
              {s.wordIds.map((id) => {
                const w = words.get(id);
                if (!w) return null;
                return (
                  <li key={id}>
                    <AudioButton audio={w.audio} size="sm" label={`播放 ${w.lemma}`} />
                    <span className="nl" lang="nl">
                      {w.lemma}
                    </span>
                    <span className="zh muted">{w.zh}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </article>
      ))}
    </div>
  );
}
