import { LockOpen, PackageOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { LessonCard } from "../components/LessonCard";
import { useContent } from "../content/context";
import { missingRanges } from "../course/progress";
import { countByStatus, displayStatus, LEVELS, recommendNext } from "../course/types";
import { useCourseData } from "../course/useCourseData";
import "./CoursesPage.css";
import { useServices } from "../servicesContext";
import { latestExamResults, type ExamResult } from "../storage/examResults";

export function CoursesPage() {
  const data = useCourseData();
  const { course, bundle, packStatus } = useContent();
  const { db } = useServices();
  const [scores, setScores] = useState<Record<string, ExamResult>>({});
  useEffect(() => {
    let active = true;
    db()
      .then(latestExamResults)
      .then((rows) => {
        if (active) setScores(Object.fromEntries(rows.map((r) => [r.id, r])));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [db]);
  const broken = packStatus === "outdated" || packStatus === "error";
  if (!data) return <p className="muted lesson-loading">正在读取…</p>;
  const recommended = recommendNext(data.sections);

  return (
    <div className="courses">
      <div className="courses-head">
        <div className="level-tabs" role="tablist" aria-label="等级">
          {LEVELS.map(({ level, available }) => (
            <button
              key={level}
              type="button"
              role="tab"
              className="level-tab"
              aria-selected={level === "A1"}
              disabled={!available}
              title={available ? undefined : "即将推出"}
            >
              <span className="level-name">{level}</span>
              {!available && <span className="level-soon">即将推出</span>}
            </button>
          ))}
        </div>
        <p className="courses-note">
          <LockOpen size={16} aria-hidden />
          所有课程随时可学，不锁课
        </p>
      </div>

      {data.sections
        .filter((s) => s.id !== "tests")
        .map((section) => {
          const view = course.find((s) => s.id === section.id)!;
          const counts = countByStatus(section.lessons);
          const missing = view.missing;
          if (section.lessons.length === 0 && missing.length === 0) return null;
          return (
            <section key={section.id} className="course-section" aria-labelledby={`sec-${section.id}`}>
              <div className="course-section-head">
                <h2 id={`sec-${section.id}`} className="section-title">
                  {section.title}
                </h2>
                {section.lessons.length > 0 && (
                  <span className="muted course-section-meta">
                    {section.lessons.length} 课 · 已掌握 {counts.mastered} · 学过 {counts.studied}
                  </span>
                )}
              </div>
              {section.lessons.length > 0 && (
                <div className="lesson-grid">
                  {(section.id === "main"
                    ? (bundle.course.sections.find((s) => s.id === "main")?.lessons.map((l) => l.id) ?? [])
                    : section.lessons.map((l) => l.id)
                  ).map((lessonId) => {
                    const lesson = section.lessons.find((l) => l.id === lessonId);
                    const testId = ({ NN35: "TT1", NN45: "TT2", NN55: "TT3" } as Record<string, string>)[lessonId];
                    const test = testId
                      ? data.sections.find((s) => s.id === "tests")?.lessons.find((l) => l.id === testId)
                      : undefined;
                    if (!lesson && !testId) return null;
                    return (
                      <div key={lessonId} className="course-map-pair">
                        {lesson && <LessonCard lesson={lesson} status={displayStatus(lesson, recommended?.id)} />}
                        {test && (
                          <LessonCard
                            lesson={test}
                            status={displayStatus(test, recommended?.id)}
                            score={scores[test.id]}
                          />
                        )}
                        {testId && !test && (
                          <article className="card course-test-missing">
                            <span className="lesson-code">测验 {testId.slice(-1)}</span>
                            <p>导入包含这次阶段测验的资料包后即可作答。</p>
                            <Link to="/settings" className="btn btn-ghost btn-small">
                              去导入资料包
                            </Link>
                          </article>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {missing.length > 0 &&
                (packStatus === "ready" ? (
                  <p className="muted course-missing">资料包里还没有：{missingRanges(missing)}</p>
                ) : (
                  <div className="card needs-pack">
                    <span className="stat-icon stat-icon-accent">
                      <PackageOpen size={20} aria-hidden />
                    </span>
                    <div className="needs-pack-text">
                      <p className="stat-title">{broken ? "资料包需要重新导入" : "需要资料包"}</p>
                      <p className="muted">
                        {broken
                          ? `已导入的资料包读不出来（版本不符或文件损坏），重新导入后就能学${missingRanges(missing)}。`
                          : `${missingRanges(missing)}的课文、原版录音和练习在 Naar Nederland 资料包里，导入一次就能学。`}
                      </p>
                    </div>
                    <Link to="/settings" className="btn btn-primary">
                      {broken ? "去重新导入" : "去导入"}
                    </Link>
                  </div>
                ))}
            </section>
          );
        })}
    </div>
  );
}
