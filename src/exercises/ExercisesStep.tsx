import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { player } from "../audio/player";
import { QuestionView } from "./QuestionView";
import { CODE_TITLE, type ExerciseGroup, type Question } from "./types";
import "./exercises.css";

export interface Score {
  correct: number;
  total: number;
}

interface Props {
  groups: ExerciseGroup[];
  onFinish: (score: Score) => void;
  /** Resume at this question */
  startAt?: number;
  onPosition?: (index: number) => void;
}

/** Step ⑤: one question per screen; book examples are shown answered and not scored. */
export function ExercisesStep({ groups, onFinish, startAt = 0, onPosition }: Props) {
  const flat = useMemo(() => groups.flatMap((g) => g.questions.map((q) => ({ q, group: g }))), [groups]);
  const [index, setIndex] = useState(Math.min(startAt, Math.max(0, flat.length - 1)));
  const [results, setResults] = useState<Record<string, boolean>>({});
  const item = flat[index];
  if (!item) return null;
  const { q, group } = item;
  const answered = q.id in results;
  const canGoOn = answered || !!q.example;
  const firstOfGroup = index === 0 || flat[index - 1].group.id !== group.id;

  const score = (): Score => {
    const scored = flat.filter((f) => !f.q.example);
    return { correct: scored.filter((f) => results[f.q.id]).length, total: scored.length };
  };
  const next = () => {
    player.stop();
    if (index + 1 < flat.length) {
      setIndex(index + 1);
      onPosition?.(index + 1);
    } else onFinish(score());
  };

  return (
    <div className="exercises-step">
      <div className="ex-head">
        <span className="tag tag-studied">
          {group.code} · {CODE_TITLE[group.code]}
        </span>
        {q.example && <span className="tag tag-recommended">示范</span>}
        <span className="sentence-count ex-count">
          第 {index + 1} / {flat.length} 题
        </span>
      </div>
      {group.instruction && (
        <div className={`ex-instruction${firstOfGroup ? "" : " is-repeat"}`}>
          <p className="zh">{group.instruction.zh}</p>
          <p className="nl muted" lang="nl">
            {group.instruction.nl}
          </p>
        </div>
      )}
      <QuestionView
        key={q.id}
        q={q as Question}
        done={answered}
        onAnswer={(ok) => setResults((r) => ({ ...r, [q.id]: ok }))}
      />
      <div className="ex-footer">
        {answered && (
          <p className={`ex-feedback ${results[q.id] ? "is-right" : "is-wrong"}`} role="status">
            {results[q.id]
              ? "答对了！"
              : q.kind === "oral"
                ? "多听几遍参考答案，下次再试。"
                : "没关系，看一下正确答案。"}
          </p>
        )}
        {q.example && !answered && <p className="ex-feedback">这是课本里的示范题，看一看就好。</p>}
        <button type="button" className="btn btn-accent" disabled={!canGoOn} onClick={next}>
          {index + 1 < flat.length ? "下一题" : "完成练习"}
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
