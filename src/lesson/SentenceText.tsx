import type { PackToken } from "../content/packTypes";
import { segmentSentence } from "../content/tokenize";

interface Props {
  text: string;
  tokens: PackToken[];
  selected?: string | null;
  onWord?: (wordId: string) => void;
  className?: string;
}

/** Dutch sentence with every word clickable (opens its dictionary entry, design §6). */
export function SentenceText({ text, tokens, selected, onWord, className = "" }: Props) {
  const segments = segmentSentence(text, tokens);
  return (
    <p className={`nl ${className}`} lang="nl">
      {segments.map((seg, i) =>
        seg.wordId && onWord ? (
          <button
            key={i}
            type="button"
            className={`word-token${selected === seg.wordId ? " is-selected" : ""}`}
            onClick={() => onWord(seg.wordId!)}
          >
            {seg.text}
          </button>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </p>
  );
}
