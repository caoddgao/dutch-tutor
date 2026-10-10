import { LockOpen, PackageOpen } from "lucide-react";
import { Link } from "react-router";
import { LessonCard } from "../components/LessonCard";
import { useContent } from "../content/context";
import { missingRanges } from "../course/progress";
import { countByStatus, displayStatus, LEVELS, recommendNext } from "../course/types";
import { useCourseData } from "../course/useCourseData";
import "./CoursesPage.css";

export function CoursesPage() {
  const data = useCourseData();
  const { course, packStatus } = useContent();
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

      {data.sections.map((section) => {
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
                {section.lessons.map((lesson) => (
                  <LessonCard key={lesson.id} lesson={lesson} status={displayStatus(lesson, recommended?.id)} />
                ))}
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
