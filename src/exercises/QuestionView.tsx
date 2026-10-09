import { Check, Volume2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAudio } from "../audio/context";
import { player } from "../audio/player";
import { AudioButton } from "../components/AudioButton";
import { RecordButton } from "./RecordButton";
import type {
  AudioChoiceQuestion,
  ChoiceQuestion,
  MatchQuestion,
  OralQuestion,
  OrderQuestion,
  Prompt,
  Question,
} from "./types";

interface Props<Q extends Question> {
  q: Q;
  /** Set once answered */
  done: boolean;
  onAnswer: (correct: boolean) => void;
}

/** Book blanks "....." are shown as a line. */
function blank(text: string): string {
  return text.replace(/\.{3,}/g, "＿＿＿");
}

function useAutoPlay(audioRef: Prompt["audio"], enabled: boolean) {
  const { resolve, rate } = useAudio();
  const url = enabled ? resolve(audioRef)?.url : undefined;
  useEffect(() => {
    if (url) void player.play(url, { rate, tag: `q:${audioRef?.id}` });
    return () => player.stop();
    // play once when the question appears
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
}

function PromptView({ prompt, done }: { prompt: Prompt; done: boolean }) {
  return (
    <div className="q-prompt">
      {prompt.audio && (
        <div className="q-listen">
          <AudioButton audio={prompt.audio} label="再听一遍" className="q-listen-btn" />
          {!prompt.nl && <span className="muted">点按钮可以再听</span>}
        </div>
      )}
      {prompt.nl && (
        <p className="nl q-nl" lang="nl">
          {blank(prompt.nl)}
        </p>
      )}
      {prompt.zh && <p className="zh q-zh">{prompt.zh}</p>}
      {done && (prompt.revealNl || prompt.revealZh) && (
        <div className="q-reveal">
          {prompt.revealNl && (
            <p className="nl" lang="nl">
              {prompt.revealNl}
            </p>
          )}
          {prompt.revealZh && <p className="zh">{prompt.revealZh}</p>}
          {prompt.revealEn && <p className="en">{prompt.revealEn}</p>}
        </div>
      )}
    </div>
  );
}

function ChoiceView({ q, done, onAnswer }: Props<ChoiceQuestion>) {
  const [picked, setPicked] = useState<number | null>(q.example ? q.answer : null);
  useAutoPlay(q.prompt.audio, !q.example);
  const show = done || q.example;
  return (
    <div className="q-body">
      <PromptView prompt={q.prompt} done={!!show} />
      <div className={`q-options${q.options.some((o) => o.zh) ? " is-meanings" : ""}`} role="group" aria-label="选项">
        {q.options.map((o, i) => {
          const state = show ? (i === q.answer ? "correct" : i === picked ? "wrong" : "") : "";
          return (
            <button
              key={i}
              type="button"
              className="q-option"
              data-state={state}
              disabled={!!show}
              onClick={() => {
                setPicked(i);
                onAnswer(i === q.answer);
              }}
            >
              {o.nl && (
                <span className="nl" lang="nl">
                  {o.nl}
                </span>
              )}
              {o.zh && <span className="zh">{o.zh}</span>}
              {o.en && <span className="en">{o.en}</span>}
              {state === "correct" && <Check size={18} className="q-mark" aria-label="正确答案" />}
              {state === "wrong" && <X size={18} className="q-mark" aria-label="你的选择" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AudioChoiceView({ q, done, onAnswer }: Props<AudioChoiceQuestion>) {
  const { resolve, rate } = useAudio();
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="q-body">
      <div className="q-prompt">
        <p className="nl q-nl q-word" lang="nl">
          {q.nl}
        </p>
        {done && q.zh && <p className="zh q-zh">{q.zh}</p>}
      </div>
      <div className="q-options q-audio-options" role="group" aria-label="读音选项">
        {q.options.map((ref, i) => {
          const r = resolve(ref);
          const state = done ? (i === q.answer ? "correct" : i === picked ? "wrong" : "") : "";
          return (
            <div key={i} className="q-option q-audio-option" data-state={state}>
              <button
                type="button"
                className="audio-btn audio-btn-md"
                disabled={!r}
                aria-label={`播放读音 ${i + 1}`}
                onClick={() => r && void player.play(r.url, { rate, tag: `opt:${ref.id}` })}
              >
                <Volume2 size={18} aria-hidden />
              </button>
              <span>读音 {i + 1}</span>
              <button
                type="button"
                className="btn btn-ghost btn-small"
                disabled={done}
                onClick={() => {
                  setPicked(i);
                  onAnswer(i === q.answer);
                }}
              >
                选这个
              </button>
              {state === "correct" && <Check size={18} className="q-mark" aria-label="正确答案" />}
              {state === "wrong" && <X size={18} className="q-mark" aria-label="你的选择" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderView({ q, done, onAnswer }: Props<OrderQuestion>) {
  const [placed, setPlaced] = useState<number[]>(q.example ? q.blocks.map((_, i) => i) : []);
  const [result, setResult] = useState<boolean | null>(null);
  const finished = done || q.example;
  const place = (i: number) => {
    const next = [...placed, i];
    setPlaced(next);
    if (next.length === q.blocks.length) {
      const ok = next.map((k) => q.blocks[k]).join(" ") === q.blocks.join(" ");
      setResult(ok);
      onAnswer(ok);
    }
  };
  return (
    <div className="q-body">
      <div className="q-prompt">
        {q.audio && <AudioButton audio={q.audio} label="听这句" />}
        {q.zh && <p className="zh q-zh">{q.zh}</p>}
        {q.en && <p className="en">{q.en}</p>}
      </div>
      <div
        className={`order-line${result === false ? " is-wrong" : result ? " is-right" : ""}`}
        aria-label="你排的句子"
      >
        {placed.map((k, pos) => (
          <button
            key={k}
            type="button"
            className="order-block is-placed"
            disabled={!!finished}
            onClick={() => setPlaced(placed.filter((_, p) => p !== pos))}
          >
            {q.blocks[k]}
          </button>
        ))}
        {placed.length === 0 && <span className="muted">点下面的词块，按顺序排成句子</span>}
      </div>
      {!finished && (
        <div className="order-pool" aria-label="词块">
          {q.shuffled.map((k) => (
            <button
              key={k}
              type="button"
              className="order-block"
              disabled={placed.includes(k)}
              onClick={() => place(k)}
            >
              {q.blocks[k]}
            </button>
          ))}
        </div>
      )}
      {done && result === false && (
        <div className="q-reveal">
          <p className="muted">正确的顺序：</p>
          <p className="nl" lang="nl">
            {q.blocks.join(" ")}
          </p>
        </div>
      )}
    </div>
  );
}

function MatchView({ q, done, onAnswer }: Props<MatchQuestion>) {
  const [left, setLeft] = useState<number | null>(null);
  const [made, setMade] = useState<[number, number][]>(q.example ? q.pairs : []);
  const finished = done || q.example;
  const correctFor = (l: number) => q.pairs.find((p) => p[0] === l)?.[1];
  const pick = (r: number) => {
    if (left === null) return;
    const next = [...made.filter((p) => p[0] !== left && p[1] !== r), [left, r] as [number, number]];
    setMade(next);
    setLeft(null);
    if (next.length === q.left.length) onAnswer(next.every(([l, rr]) => correctFor(l) === rr));
  };
  const pairOf = (l: number) => made.find((p) => p[0] === l);
  return (
    <div className="q-body">
      <div className="match-grid">
        <div className="match-col" aria-label="左边">
          {q.left.map((t, i) => {
            const p = pairOf(i);
            const state = finished
              ? p && correctFor(i) === p[1]
                ? "correct"
                : "wrong"
              : left === i
                ? "active"
                : p
                  ? "paired"
                  : "";
            return (
              <button
                key={i}
                type="button"
                className="match-item"
                data-state={state}
                disabled={!!finished}
                onClick={() => setLeft(i)}
              >
                <span className="match-num">{i + 1}</span>
                <span className="nl" lang="nl">
                  {t}
                </span>
              </button>
            );
          })}
        </div>
        <div className="match-col" aria-label="右边">
          {q.right.map((t, j) => {
            const owner = made.find((p) => p[1] === j);
            return (
              <button
                key={j}
                type="button"
                className="match-item"
                data-state={owner ? "paired" : ""}
                disabled={!!finished || left === null}
                onClick={() => pick(j)}
              >
                <span className="match-num">{owner ? owner[0] + 1 : "·"}</span>
                <span className="nl" lang="nl">
                  {t}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {done && !q.example && (
        <div className="q-reveal">
          <p className="muted">正确的配对：</p>
          {q.pairs.map(([l, r]) => (
            <p key={l} className="nl" lang="nl">
              {q.left[l]} — {q.right[r]}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function OralView({ q, done, onAnswer }: Props<OralQuestion>) {
  const [revealed, setRevealed] = useState(!!q.example);
  useAutoPlay(q.prompt.audio, !q.example);
  return (
    <div className="q-body">
      <div className="q-prompt">
        <div className="q-listen">
          <AudioButton audio={q.prompt.audio} label="再听一遍" className="q-listen-btn" />
          <div>
            <p className="nl q-nl" lang="nl">
              {q.prompt.nl}
            </p>
            {q.prompt.zh && <p className="zh q-zh">{q.prompt.zh}</p>}
          </div>
        </div>
        {q.start && (
          <p className="nl q-start" lang="nl">
            {q.start.nl}
            <span className="muted zh"> （{q.start.zh}）</span>
          </p>
        )}
      </div>
      {!q.example && <RecordButton id={q.id} />}
      {!revealed ? (
        <button type="button" className="btn btn-ghost q-reveal-btn" onClick={() => setRevealed(true)}>
          看参考答案
        </button>
      ) : (
        <div className="q-reveal">
          <p className="muted">参考答案</p>
          {q.samples.map((s, i) => (
            <div key={i} className="q-sample">
              {s.audio && <AudioButton audio={s.audio} size="sm" label="播放参考答案" />}
              <div>
                <p className="nl" lang="nl">
                  {s.nl}
                </p>
                {s.zh && <p className="zh muted">{s.zh}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
      {revealed && !done && !q.example && (
        <div className="self-rate" role="group" aria-label="自评">
          <span className="muted">我说得：</span>
          <button type="button" className="btn btn-ghost" onClick={() => onAnswer(true)}>
            会
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => onAnswer(false)}>
            模糊
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => onAnswer(false)}>
            不会
          </button>
        </div>
      )}
    </div>
  );
}

export function QuestionView(props: Props<Question>) {
  const { q } = props;
  switch (q.kind) {
    case "choice":
      return <ChoiceView {...props} q={q} />;
    case "audio-choice":
      return <AudioChoiceView {...props} q={q} />;
    case "order":
      return <OrderView {...props} q={q} />;
    case "match":
      return <MatchView {...props} q={q} />;
    case "oral":
      return <OralView {...props} q={q} />;
  }
}
