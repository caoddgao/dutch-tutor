import { ReportButton } from "../components/ReportButton";
import type { RtSentence } from "../content/model";
import { SentenceText } from "./SentenceText";

interface Props {
  lessonId: string;
  sentence: RtSentence;
  index: number;
  total: number;
  /** Shown as a tag, e.g. "认读小文" */
  label?: string;
  selectedWord: string | null;
  onWord: (id: string) => void;
}

/**
 * Step ② (and the sentences of a reading text): one sentence per screen — big Dutch centred, Chinese below,
 * English optional.
 */
export function SentenceStep({ lessonId, sentence, index, total, label, selectedWord, onWord }: Props) {
  return (
    <div className="sentence-step">
      <div className="sentence-meta">
        <span className="sentence-count">
          第 {index + 1} / {total} 句
        </span>
        {label && <span className="tag tag-recommended">{label}</span>}
        {sentence.speaker && <span className="speaker-chip">{sentence.speaker}</span>}
        {sentence.kind === "added" && <span className="tag tag-new">补充短句</span>}
        <ReportButton target={{ type: "sentence", id: sentence.id, lessonId, nl: sentence.nl, zh: sentence.zh }} />
      </div>
      <div className="sentence-display">
        <SentenceText
          text={sentence.nl}
          tokens={sentence.tokens}
          selected={selectedWord}
          onWord={onWord}
          className="nl-sentence sentence-nl"
        />
        <p className="zh sentence-zh">{sentence.zh}</p>
        <p className="en sentence-en">{sentence.en}</p>
      </div>
    </div>
  );
}
