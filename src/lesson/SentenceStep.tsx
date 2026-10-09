import type { RtLesson, RtSentence } from "../content/model";
import { SentenceText } from "./SentenceText";

interface Props {
  lesson: RtLesson;
  sentence: RtSentence;
  index: number;
  selectedWord: string | null;
  onWord: (id: string) => void;
}

/** Step ②: one sentence per screen — big Dutch centred, Chinese below, English optional. */
export function SentenceStep({ lesson, sentence, index, selectedWord, onWord }: Props) {
  return (
    <div className="sentence-step">
      <div className="sentence-meta">
        <span className="sentence-count">
          第 {index + 1} / {lesson.sentences.length} 句
        </span>
        {sentence.speaker && <span className="speaker-chip">{sentence.speaker}</span>}
        {sentence.kind === "added" && <span className="tag tag-new">补充短句</span>}
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
