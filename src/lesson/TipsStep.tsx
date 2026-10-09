import { AudioButton } from "../components/AudioButton";
import type { RtLesson, RtSentence } from "../content/model";

function Example({ s }: { s: RtSentence }) {
  return (
    <li className="tip-example">
      <AudioButton audio={s.audio} size="sm" label="播放例句" />
      <div>
        <p className="nl" lang="nl">
          {s.nl}
        </p>
        <p className="zh">{s.zh}</p>
        <p className="en">{s.en}</p>
      </div>
    </li>
  );
}

/** Step ④: the lesson's tips (short Chinese explanation, examples, optional table) and EXTRA example boxes. */
export function TipsStep({ lesson }: { lesson: RtLesson }) {
  return (
    <div className="tips-step">
      {lesson.tips.map((tip) => (
        <article key={tip.id} className="tip-full">
          <h2 className="tip-full-title">{tip.title.zh}</h2>
          {tip.title.en && <p className="en">{tip.title.en}</p>}
          {tip.bodyZh.map((p, i) => (
            <p key={i} className="tip-full-body">
              {p}
            </p>
          ))}
          {tip.table && (
            <table className="tip-table">
              <thead>
                <tr>
                  {tip.table.head.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tip.table.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((c, j) => (
                      <td key={j} lang={j === 0 ? "nl" : undefined}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <ul className="tip-examples">
            {tip.examples.map((s) => (
              <Example key={s.id} s={s} />
            ))}
          </ul>
        </article>
      ))}
      {lesson.extras.map((box) => (
        <article key={box.id} className="tip-full extra-box">
          <h2 className="tip-full-title">例句框</h2>
          <ul className="tip-examples">
            {box.sentences.map((s) => (
              <Example key={s.id} s={s} />
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
