import { AudioButton } from "../components/AudioButton";
import type { RtLesson, RtSentence, RtTip } from "../content/model";

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

function TipBody({ tip }: { tip: RtTip }) {
  return (
    <>
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
    </>
  );
}

/**
 * Step ④: the lesson's tips (short Chinese explanation, examples, optional table), tips from earlier
 * lessons that come up again (folded, design §2.3) and the remaining EXTRA example boxes.
 */
export function TipsStep({ lesson }: { lesson: RtLesson }) {
  return (
    <div className="tips-step">
      {lesson.tips.map((tip) => (
        <article key={tip.id} className="tip-full">
          <h2 className="tip-full-title">{tip.title.zh}</h2>
          {tip.title.en && <p className="en">{tip.title.en}</p>}
          <TipBody tip={tip} />
        </article>
      ))}
      {lesson.tipLinks.length > 0 && (
        <section className="tip-links" aria-label="前面学过的小贴士">
          <h2 className="tip-links-title">前面学过，这一课又用到</h2>
          {lesson.tipLinks.map((tip) => (
            <details key={tip.id} className="tip-link">
              <summary>
                <span className="tip-link-name">{tip.title.zh}</span>
                {tip.title.en && <span className="en"> · {tip.title.en}</span>}
              </summary>
              <div className="tip-full">
                <TipBody tip={tip} />
              </div>
            </details>
          ))}
        </section>
      )}
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
