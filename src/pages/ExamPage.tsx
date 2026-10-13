import { ArrowLeft, BookOpen, ExternalLink, Mic2, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useContent } from "../content/context";
import { ownGroup } from "../exercises/build";
import { ExercisesStep, type Score } from "../exercises/ExercisesStep";
import { seededRandom } from "../exercises/random";
import type { ExerciseGroup } from "../exercises/types";
import { useServices } from "../servicesContext";
import { latestExamResults, saveExamResult, type ExamResult } from "../storage/examResults";
import "./ExamPage.css";

type Part = "oral" | "reading";
const EXAM_ID = "A1-MOCK-1";
const OFFICIAL_URL = "https://www.naarnederland.nl/en-GB/taking-practice-exams";

export function ExamPage() {
  const { bundle, dict } = useContent();
  const { db } = useServices();
  const exam = bundle.exams?.[EXAM_ID];
  const [part, setPart] = useState<Part | null>(null);
  const [run, setRun] = useState(0);
  const [results, setResults] = useState<Record<string, ExamResult>>({});
  const [completed, setCompleted] = useState<Score | null>(null);

  useEffect(() => {
    let active = true;
    db()
      .then(latestExamResults)
      .then((rows) => {
        if (active) setResults(Object.fromEntries(rows.map((r) => [r.id, r])));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [db]);

  const groups = useMemo(() => {
    const oral: ExerciseGroup[] = [];
    const reading: ExerciseGroup[] = [];
    for (const ex of exam?.exercises ?? []) {
      const group = ownGroup({ words: [], sentences: [] }, ex, dict, bundle.tts, seededRandom(ex.id));
      if (group) (ex.type === "oral_answer" || ex.type === "oral_complete" ? oral : reading).push(group);
    }
    return { oral, reading };
  }, [exam, dict, bundle.tts]);

  const start = (which: Part) => {
    setPart(which);
    setCompleted(null);
    setRun((n) => n + 1);
  };
  const finish = (score: Score) => {
    setCompleted(score);
    if (!part) return;
    const id = `${EXAM_ID}-${part}`;
    setResults((r) => ({ ...r, [id]: { id, ...score, taken_at: new Date().toISOString() } }));
    db()
      .then((d) => saveExamResult(d, id, score.correct, score.total))
      .catch(() => undefined);
  };

  return (
    <div className="exam-page">
      <section className="immersive exam-hero">
        <span className="exam-kicker">A1 · 结业模拟考</span>
        <h2>把学过的荷兰语用起来</h2>
        <p>口语先开口作答，再听参考答案并自评；阅读按真实题型练习。两部分都可以反复做。</p>
      </section>
      {!part ? (
        <div className="exam-parts">
          <section className="card exam-part-card">
            <div className="exam-part-icon">
              <Mic2 size={25} aria-hidden />
            </div>
            <div>
              <span className="tag tag-recommended">口语</span>
              <h3>问答与补全句子</h3>
              <p className="muted">10 道问答 · 12 道补全句子 · 先自评</p>
            </div>
            {results[`${EXAM_ID}-oral`] && (
              <p className="exam-last">
                上次自评 {results[`${EXAM_ID}-oral`].correct} / {results[`${EXAM_ID}-oral`].total}
              </p>
            )}
            <button type="button" className="btn btn-accent" onClick={() => start("oral")}>
              {results[`${EXAM_ID}-oral`] ? "再练口语" : "开始口语"}
            </button>
          </section>
          <section className="card exam-part-card">
            <div className="exam-part-icon">
              <BookOpen size={25} aria-hidden />
            </div>
            <div>
              <span className="tag tag-studied">阅读</span>
              <h3>拼写、读音与短文</h3>
              <p className="muted">技术性阅读 9 题 · 功能性阅读 5 篇各 2 题</p>
            </div>
            {results[`${EXAM_ID}-reading`] && (
              <p className="exam-last">
                上次得分 {results[`${EXAM_ID}-reading`].correct} / {results[`${EXAM_ID}-reading`].total}
              </p>
            )}
            <button type="button" className="btn btn-primary" onClick={() => start("reading")}>
              {results[`${EXAM_ID}-reading`] ? "再练阅读" : "开始阅读"}
            </button>
          </section>
        </div>
      ) : (
        <section className="card exam-session">
          <div className="exam-session-head">
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setPart(null)}>
              <ArrowLeft size={16} aria-hidden /> 返回考试
            </button>
            <h3>{part === "oral" ? "口语练习" : "阅读练习"}</h3>
          </div>
          {completed ? (
            <div className="exam-result">
              <strong>
                {completed.correct} / {completed.total}
              </strong>
              <p>{part === "oral" ? "这是根据你的自评统计的结果。" : "本次阅读练习完成了。"}</p>
              <button type="button" className="btn btn-accent" onClick={() => start(part)}>
                <RotateCcw size={16} aria-hidden /> 再做一次
              </button>
            </div>
          ) : (
            <ExercisesStep key={`${part}-${run}`} groups={groups[part]} onFinish={finish} />
          )}
        </section>
      )}
      <aside className="card exam-official">
        <div>
          <h3>还想试试官方练习考？</h3>
          <p className="muted">官方口语练习考约 30 分钟；阅读练习考有 19 题，限时 35 分钟。</p>
        </div>
        <a className="btn btn-ghost" href={OFFICIAL_URL} target="_blank" rel="noreferrer">
          打开官方练习考 <ExternalLink size={16} aria-hidden />
        </a>
      </aside>
    </div>
  );
}
