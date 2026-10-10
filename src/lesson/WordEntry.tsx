import { AudioButton } from "../components/AudioButton";
import type { RtWord } from "../content/model";
import { POS_LABEL } from "../content/pos";

interface Props {
  word: RtWord;
  showPastParticiple: boolean;
  /** "panel": compact side panel; "card": full word card (step ③) */
  variant?: "panel" | "card";
}

function nounLine(w: RtWord): string | null {
  if (w.pos !== "zn") return null;
  const art = w.article ? `${w.article} ${w.lemma}` : w.lemma;
  return w.plural ? `${art} · 复数 ${w.plural}` : art;
}

/** A dictionary entry: lemma, part of speech, article / plural or verb forms, meanings (design §6). */
export function WordEntry({ word, showPastParticiple, variant = "panel" }: Props) {
  const pos = POS_LABEL[word.pos];
  const noun = nounLine(word);
  const forms = word.verbForms;
  const lemma = word.separable ? word.separable.replace("|", "·") : word.lemma;
  const nnDiffers = (word.zhNn && word.zhNn !== word.zh) || (word.enNn && word.enNn !== word.en);
  return (
    <div className={`word-entry word-entry-${variant}`}>
      <div className="word-entry-head">
        <div className="word-entry-lemma-wrap">
          {word.pos === "zn" && word.article && <span className="word-article">{word.article}</span>}
          <span className="nl word-entry-lemma" lang="nl">
            {lemma}
          </span>
        </div>
        <AudioButton audio={word.audio} label={`播放 ${word.lemma}`} />
      </div>
      <div className="word-entry-badges">
        <span className={`pos-badge pos-${word.pos}`}>
          {pos.abbr} {pos.zh}
        </span>
        {word.separable && <span className="pos-badge pos-sep">可分动词</span>}
      </div>
      {noun && (
        <p className="nl word-entry-forms" lang="nl">
          {noun}
        </p>
      )}
      {forms && (
        <dl className="verb-forms" lang="nl">
          {(["ik", "jij", "hij", "wij"] as const).map((k) =>
            forms[k] ? (
              <div key={k}>
                <dt>{k === "hij" ? "hij/zij" : k}</dt>
                <dd>{forms[k]}</dd>
              </div>
            ) : null,
          )}
          {showPastParticiple && forms.pp && (
            <div>
              <dt>{forms.aux === "zijn" ? "ik ben" : "ik heb"}</dt>
              <dd>{forms.pp}</dd>
            </div>
          )}
        </dl>
      )}
      <p className="zh word-entry-zh">{word.zh}</p>
      <p className="en word-entry-en">{word.en}</p>
      {nnDiffers && (
        <p className="word-entry-nn">
          <span className="word-entry-nn-label">原词表</span>
          {word.zhNn && <span className="zh">{word.zhNn}</span>}
          {word.enNn && (
            <span className="en">
              {word.zhNn ? " · " : ""}
              {word.enNn}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
