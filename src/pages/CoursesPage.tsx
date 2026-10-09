import { LockOpen } from "lucide-react";
import { LessonCard } from "../components/LessonCard";
import { DEMO_SECTIONS } from "../course/demoCourse";
import { countByStatus, displayStatus, LEVELS, recommendNext } from "../course/types";
import "./CoursesPage.css";

export function CoursesPage() {
  const sections = DEMO_SECTIONS;
  const recommended = recommendNext(sections);

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

      {sections.map((section) => {
        const counts = countByStatus(section.lessons);
        return (
          <section key={section.id} className="course-section" aria-labelledby={`sec-${section.id}`}>
            <div className="course-section-head">
              <h2 id={`sec-${section.id}`} className="section-title">
                {section.title}
              </h2>
              <span className="muted course-section-meta">
                {section.lessons.length} 课 · 已掌握 {counts.mastered} · 学过 {counts.studied}
              </span>
            </div>
            <div className="lesson-grid">
              {section.lessons.map((lesson) => (
                <LessonCard key={lesson.id} lesson={lesson} status={displayStatus(lesson, recommended?.id)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
