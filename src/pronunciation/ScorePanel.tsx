import type { Assessment } from "./context";
import "./score.css";

export function ScorePanel({ result }: { result: Assessment }) {
  const scores = [
    ["总分", result.total],
    ["准确度", result.accuracy],
    ["流利度", result.fluency],
    ["完整度", result.completeness],
  ] as const;
  return (
    <div className="pronunciation-score" role="status">
      <div className="pronunciation-score-grid">
        {scores.map(([name, score]) => (
          <div key={name}>
            <span>{name}</span>
            <strong>{Math.round(score)}</strong>
          </div>
        ))}
      </div>
      <div className="pronunciation-words">
        <strong>需要多练的词</strong>
        {result.low_words.length ? (
          <ul>
            {result.low_words.map((word, index) => (
              <li key={`${word.word}-${index}`}>
                <span lang="nl">{word.word}</span>
                <span>{Math.round(word.accuracy)} 分</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>没有明显读错的词。</p>
        )}
      </div>
    </div>
  );
}
