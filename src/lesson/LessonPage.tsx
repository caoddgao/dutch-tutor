import { ArrowLeft, Check, ChevronLeft, ChevronRight, PackageOpen } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { player } from "../audio/player";
import { EmptyState } from "../components/EmptyState";
import { PlayerBar } from "../components/PlayerBar";
import { useContent } from "../content/context";
import type { RtLesson } from "../content/model";
import { useServices } from "../servicesContext";
import { completeLesson, getProgress, markStudyDay, savePosition } from "../storage/learning";
import { latestExamResults, saveExamResult } from "../storage/examResults";
import { buildExercises, type ExerciseGroup } from "../exercises/build";
import { ExercisesStep, type Score } from "../exercises/ExercisesStep";
import { DoneStep } from "./DoneStep";
import { ListenStep } from "./ListenStep";
import { reviewSeeds } from "./reviewSeeds";
import { SentenceStep } from "./SentenceStep";
import { SidePanel } from "./SidePanel";
import { SoundsStep } from "./SoundsStep";
import { STEP, stepsFor, wordCards, type StepCode } from "./steps";
import { TipsStep } from "./TipsStep";
import { WordsStep } from "./WordsStep";
import "./LessonPage.css";

type Load =
  | { state: "loading" }
  | { state: "ready"; lesson: RtLesson }
  | { state: "needs-pack" }
  | { state: "reimport" }
  | { state: "not-in-pack" }
  | { state: "missing" };

export function LessonPage() {
  const { id = "" } = useParams();
  const { loadLesson, packStatus, course } = useContent();
  const [loaded, setLoaded] = useState<{ id: string; lesson: RtLesson | null } | null>(null);

  const courseLesson = useMemo(
    () => course.flatMap((s) => [...s.lessons, ...s.missing]).find((l) => l.id === id),
    [course, id],
  );
  const needsPack = courseLesson?.source === "pack" && packStatus !== "ready";

  useEffect(() => {
    let cancelled = false;
    if (!courseLesson || needsPack) return;
    loadLesson(id).then((lesson) => {
      if (!cancelled) setLoaded({ id, lesson });
    });
    return () => {
      cancelled = true;
    };
  }, [id, courseLesson, needsPack, loadLesson]);

  let load: Load;
  if (packStatus === "loading") load = { state: "loading" };
  else if (!courseLesson) load = { state: "missing" };
  else if (needsPack) load = { state: packStatus === "none" ? "needs-pack" : "reimport" };
  else if (loaded?.id !== id) load = { state: "loading" };
  else if (loaded.lesson) load = { state: "ready", lesson: loaded.lesson };
  else load = { state: courseLesson.source === "pack" ? "not-in-pack" : "missing" };

  if (load.state === "loading") return <p className="muted lesson-loading">正在打开…</p>;
  if (load.state === "needs-pack")
    return (
      <EmptyState
        icon={PackageOpen}
        title="需要资料包"
        action={
          <Link to="/settings" className="btn btn-primary">
            去导入资料包
          </Link>
        }
      >
        这一课的课文、原版录音和练习在 Naar Nederland 资料包里。导入一次之后就能学。
      </EmptyState>
    );
  if (load.state === "reimport" || load.state === "not-in-pack")
    return (
      <EmptyState
        icon={PackageOpen}
        title={load.state === "reimport" ? "资料包需要重新导入" : "资料包里没有这一课"}
        action={
          <Link to="/settings" className="btn btn-primary">
            去重新导入
          </Link>
        }
      >
        {load.state === "reimport"
          ? "已导入的资料包读不出来（版本不符或文件损坏）。重新导入一次之后就能学。"
          : `现在的资料包里还没有这一课（${courseLesson?.code}）。导入包含这一课的新版资料包之后就能学。`}
      </EmptyState>
    );
  if (load.state === "missing")
    return (
      <EmptyState
        icon={PackageOpen}
        title="找不到这一课"
        action={
          <Link to="/courses" className="btn btn-primary">
            返回课程地图
          </Link>
        }
      />
    );
  return <Lesson key={load.lesson.id} lesson={load.lesson} />;
}

function Lesson({ lesson }: { lesson: RtLesson }) {
  const { db } = useServices();
  const { dict, bundle } = useContent();
  const navigate = useNavigate();
  const groups: ExerciseGroup[] = useMemo(() => buildExercises(lesson, dict, bundle.tts), [lesson, dict, bundle.tts]);
  const questionCount = groups.reduce((n, g) => n + g.questions.length, 0);
  const steps = useMemo(() => stepsFor(lesson, questionCount > 0), [lesson, questionCount]);
  const cards = useMemo(() => wordCards(lesson), [lesson]);
  const readingCount = lesson.reading?.sentences.length ?? 0;
  const [score, setScore] = useState<Score | null>(null);
  const [pos, setPos] = useState<{ step: StepCode; index: number } | null>(null);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [added, setAdded] = useState<number | null>(null);
  const completing = useRef(false);

  // resume where the learner left off (design §3: 断点续学)
  useEffect(() => {
    let cancelled = false;
    db()
      .then((d) => getProgress(d, lesson.id))
      .then((p) => {
        if (cancelled) return;
        const saved = steps.find((s) => s.code === p?.current_step);
        setPos(
          lesson.kind !== "test" && saved
            ? { step: saved.code, index: p!.current_index }
            : { step: steps[0].code, index: 0 },
        );
      })
      .catch(() => !cancelled && setPos({ step: steps[0].code, index: 0 }));
    return () => {
      cancelled = true;
    };
  }, [db, lesson.id, steps]);

  useEffect(() => {
    if (lesson.kind !== "test") return;
    db()
      .then(latestExamResults)
      .then((rows) => {
        const result = rows.find((row) => row.id === lesson.id);
        if (result) setScore({ correct: result.correct, total: result.total });
      })
      .catch(() => undefined);
  }, [db, lesson.id, lesson.kind]);

  const countFor = useCallback(
    (code: StepCode) =>
      code === STEP.sentences
        ? lesson.sentences.length
        : code === STEP.words
          ? cards.length
          : code === STEP.reading
            ? 1 + readingCount
            : 1,
    [lesson, cards, readingCount],
  );

  const go = useCallback(
    (step: StepCode, index = 0) => {
      player.stop();
      const safe = Math.max(0, Math.min(index, countFor(step) - 1));
      setPos({ step, index: safe });
      setSelectedWord(null);
      db()
        .then((d) => savePosition(d, lesson.id, step, safe))
        .catch(() => undefined);
    },
    [db, lesson.id, countFor],
  );

  const stepIdx = pos ? steps.findIndex((s) => s.code === pos.step) : 0;
  const nextStep = () => {
    const n = steps[stepIdx + 1];
    if (n) go(n.code, 0);
  };
  const next = () => {
    if (!pos) return;
    if (pos.step === STEP.sentences || (pos.step === STEP.reading && pos.index > 0)) {
      db()
        .then((d) => markStudyDay(d, new Date(), { sentences: 1 }))
        .catch(() => undefined);
    }
    if (pos.index + 1 < countFor(pos.step)) go(pos.step, pos.index + 1);
    else nextStep();
  };
  const prev = () => {
    if (!pos) return;
    if (pos.index > 0) go(pos.step, pos.index - 1);
    else if (stepIdx > 0) {
      const p = steps[stepIdx - 1];
      go(p.code, countFor(p.code) - 1);
    }
  };

  // reaching ⑥: the lesson counts as studied and its items enter the review queue
  useEffect(() => {
    if (pos?.step !== STEP.done || completing.current) return;
    completing.current = true;
    db()
      .then(async (d) => {
        const r = await completeLesson(d, lesson.id, reviewSeeds(lesson));
        await markStudyDay(d, new Date());
        setAdded(r.added);
      })
      .catch(() => setAdded(0));
  }, [pos?.step, db, lesson]);

  // keyboard: ← / → move, space plays
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  const onKeyNow = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
    if (pos?.step !== STEP.sentences && pos?.step !== STEP.words && pos?.step !== STEP.reading) return;
    if (e.key === "ArrowRight") next();
    else if (e.key === "ArrowLeft") prev();
    else if (e.key === " " && target?.tagName !== "BUTTON") {
      e.preventDefault();
      document.querySelector<HTMLButtonElement>(".player-play")?.click();
    }
  };
  useEffect(() => {
    keyRef.current = onKeyNow;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The play bar sticks to the bottom of the scroll area; reserve its height there so paging,
  // focus and the browser's own scrolling never leave a line underneath it.
  const reservePlayer = useCallback((el: HTMLDivElement | null) => {
    const scroller = el?.closest<HTMLElement>(".content");
    if (!el || !scroller) return;
    const reserve = () => scroller.style.setProperty("--player-reserve", `${el.offsetHeight}px`);
    reserve();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(reserve);
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      scroller.style.removeProperty("--player-reserve");
    };
  }, []);

  if (!pos) return <p className="muted lesson-loading">正在打开…</p>;

  const sentence = pos.step === STEP.sentences ? lesson.sentences[pos.index] : undefined;
  const word = pos.step === STEP.words ? cards[pos.index] : undefined;
  // reading text: index 0 is listening to the whole text, 1… its sentences
  const reading = pos.step === STEP.reading ? lesson.reading : undefined;
  const readingListen = reading && pos.index === 0 ? reading : undefined;
  const readingSentence = reading && pos.index > 0 ? reading.sentences[pos.index - 1] : undefined;
  const panelWord = selectedWord
    ? (lesson.words.find((w) => w.id === selectedWord) ?? dict.words.get(selectedWord) ?? null)
    : null;
  // the word card and the sound cards already show everything the side column would
  const wide =
    pos.step === STEP.done || pos.step === STEP.exercises || (pos.step === STEP.intro && lesson.kind === "phonics");
  const lookupWord = (wid: string) => {
    setSelectedWord(wid);
  };
  const soundHint = word ? lesson.sounds.find((s) => s.wordIds.includes(word.id))?.grapheme : null;
  const isLast = stepIdx === steps.length - 1;
  const counter = (n: number, total: number) => (
    <>
      <button type="button" className="nav-round" aria-label="上一个" onClick={prev}>
        <ChevronLeft size={20} aria-hidden />
      </button>
      <span className="nav-count">
        {n} / {total}
      </span>
      <button type="button" className="nav-round" aria-label="下一个" onClick={next}>
        <ChevronRight size={20} aria-hidden />
      </button>
    </>
  );

  const playerBar =
    pos.step === STEP.intro && lesson.kind === "main" && lesson.fullAudio ? (
      <PlayerBar audio={lesson.fullAudio} segment={lesson.fullSegment} canRecord={false} />
    ) : sentence ? (
      <PlayerBar audio={sentence.audio} nav={counter(pos.index + 1, lesson.sentences.length)} />
    ) : word ? (
      <PlayerBar audio={word.audio} nav={counter(pos.index + 1, cards.length)} />
    ) : readingListen?.fullAudio ? (
      <PlayerBar audio={readingListen.fullAudio} canRecord={false} />
    ) : readingSentence ? (
      <PlayerBar audio={readingSentence.audio} nav={counter(pos.index, readingCount)} />
    ) : null;

  return (
    <div className="lesson" data-kind={lesson.kind}>
      <header className="lesson-head">
        <button type="button" className="btn btn-ghost btn-small" onClick={() => navigate("/courses")}>
          <ArrowLeft size={16} aria-hidden />
          课程地图
        </button>
        <div className="lesson-title">
          <span className="lesson-code-chip">{lesson.code}</span>
          <h2 className="nl lesson-title-nl" lang="nl">
            {lesson.title.nl}
          </h2>
          <span className="zh muted">{lesson.title.zh}</span>
        </div>
      </header>

      <nav className="stepper" aria-label="上课步骤">
        <ol>
          {steps.map((s, i) => {
            const state = i < stepIdx ? "done" : i === stepIdx ? "current" : "todo";
            return (
              <li key={s.code} data-state={state}>
                <button
                  type="button"
                  aria-current={state === "current" ? "step" : undefined}
                  onClick={() => go(s.code)}
                >
                  <span className="stepper-dot">{state === "done" ? <Check size={14} aria-hidden /> : i + 1}</span>
                  <span className="stepper-label">{s.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className={`lesson-body${wide ? " is-wide" : ""}`}>
        <section className="card lesson-main">
          {pos.step === STEP.intro && lesson.kind === "main" && <ListenStep lesson={lesson} />}
          {pos.step === STEP.intro && lesson.kind === "phonics" && <SoundsStep lesson={lesson} />}
          {sentence && (
            <SentenceStep
              sentence={sentence}
              index={pos.index}
              total={lesson.sentences.length}
              selectedWord={selectedWord}
              onWord={lookupWord}
            />
          )}
          {word && <WordsStep lesson={lesson} word={word} index={pos.index} total={cards.length} />}
          {readingListen && <ListenStep lesson={readingListen} reading />}
          {readingSentence && (
            <SentenceStep
              sentence={readingSentence}
              index={pos.index - 1}
              total={readingCount}
              label="认读小文"
              selectedWord={selectedWord}
              onWord={lookupWord}
            />
          )}
          {pos.step === STEP.tips && <TipsStep lesson={lesson} />}
          {pos.step === STEP.exercises && (
            <ExercisesStep
              groups={groups}
              startAt={pos.index}
              onPosition={(i) =>
                db()
                  .then((d) => savePosition(d, lesson.id, STEP.exercises, i))
                  .catch(() => undefined)
              }
              onFinish={(s) => {
                setScore(s);
                if (lesson.kind === "test")
                  db()
                    .then((d) => saveExamResult(d, lesson.id, s.correct, s.total))
                    .catch(() => undefined);
                nextStep();
              }}
            />
          )}
          {pos.step === STEP.done && (
            <DoneStep
              lesson={lesson}
              added={added}
              score={score}
              onRestart={() => {
                completing.current = false;
                setAdded(null);
                setScore(null);
                go(steps[0].code);
              }}
            />
          )}
          {(pos.step === STEP.intro || pos.step === STEP.tips) && !isLast && (
            <div className="lesson-main-footer">
              <button type="button" className="btn btn-accent" onClick={nextStep}>
                下一步：{steps[stepIdx + 1]?.label}
                <ChevronRight size={16} aria-hidden />
              </button>
            </div>
          )}
          {readingListen && (
            <div className="lesson-main-footer">
              <button type="button" className="btn btn-accent" onClick={() => go(STEP.reading, 1)}>
                下一步：逐句跟读
                <ChevronRight size={16} aria-hidden />
              </button>
            </div>
          )}
        </section>
        {!wide && (
          <SidePanel
            lesson={lesson}
            word={panelWord}
            showWord={pos.step !== STEP.words}
            soundHint={soundHint}
            onOpenTips={steps.some((s) => s.code === STEP.tips) ? () => go(STEP.tips) : undefined}
          />
        )}
      </div>

      {playerBar && (
        <div className="lesson-player" key={pos.step} ref={reservePlayer}>
          {playerBar}
        </div>
      )}
    </div>
  );
}
