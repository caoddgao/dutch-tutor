import { ArrowRight, BookOpen, Flame, MessageSquareText, PackageOpen, Play, Repeat2 } from "lucide-react";
import { useNavigate } from "react-router";
import { ProgressBar } from "../components/ProgressBar";
import { useContent } from "../content/context";
import { countByStatus } from "../course/types";
import { useCourseData } from "../course/useCourseData";
import { greetingFor } from "./greeting";
import "./HomePage.css";

export function HomePage() {
  const navigate = useNavigate();
  const greeting = greetingFor(new Date().getHours());
  const data = useCourseData();
  const { course } = useContent();
  if (!data) return <p className="muted lesson-loading">正在读取…</p>;
  const allLessons = data.sections.flatMap((s) => s.lessons);
  const courseTotal = course.reduce((n, s) => n + s.lessons.length + s.missing.length, 0);
  const counts = countByStatus(allLessons);
  const learned = counts.studied + counts.mastered;
  const cont = data.continueInfo;
  const current = cont?.lesson;
  const { reviewsToday, sentencesLearned, streakDays } = data.records;

  return (
    <div className="home">
      <header className="home-greeting">
        <p className="nl home-hello">{greeting.nl}</p>
        <p className="zh muted">{greeting.zh}，今天也学一点吧。</p>
      </header>

      <div className="home-grid">
        <section className="immersive continue-card" aria-label="继续学习">
          <div className="continue-top">
            <span className="continue-chip">{cont?.stepLabel ? "继续学习" : "推荐下一课"}</span>
            {current && <span className="continue-code">A1 · {current.code}</span>}
          </div>
          {current ? (
            <div className="continue-title">
              <h2 className="nl continue-nl">{current.title.nl}</h2>
              <p className="zh continue-zh">{current.title.zh}</p>
              <p className="en continue-en">{current.title.en}</p>
            </div>
          ) : (
            <div className="continue-title">
              <h2 className="continue-nl continue-nl-zh">导入资料包，开始学正课</h2>
              <p className="zh continue-zh">发音入门都学过了。正课从第 21 课开始，需要 Naar Nederland 资料包。</p>
            </div>
          )}
          <div className="continue-bottom">
            <div className="continue-progress">
              {current && (
                <>
                  <div className="continue-progress-text">
                    <span>{cont?.stepLabel ?? "还没开始"}</span>
                    {cont?.position && (
                      <span>
                        {cont.position} / {cont.total} 句
                      </span>
                    )}
                  </div>
                  <ProgressBar value={current.progress} label="本课进度" />
                </>
              )}
            </div>
            <div className="continue-action">
              {current ? (
                <>
                  <button
                    type="button"
                    className="play-button"
                    aria-label={cont?.stepLabel ? "接着学" : "开始学"}
                    onClick={() => navigate(`/lesson/${current.id}`)}
                  >
                    <Play size={26} fill="currentColor" strokeWidth={0} aria-hidden />
                  </button>
                  <span className="continue-action-label">{cont?.stepLabel ? "接着学" : "开始学"}</span>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="play-button"
                    aria-label="去导入资料包"
                    onClick={() => navigate("/settings")}
                  >
                    <PackageOpen size={26} aria-hidden />
                  </button>
                  <span className="continue-action-label">去导入</span>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="card stat-card review-card" aria-label="今日复习">
          <div className="stat-head">
            <span className="stat-icon stat-icon-accent">
              <Repeat2 size={20} aria-hidden />
            </span>
            <span className="stat-title">今日复习</span>
          </div>
          <p className="stat-number">
            {reviewsToday}
            <span className="stat-unit">项</span>
          </p>
          <p className="muted stat-desc">
            {reviewsToday > 0
              ? `句子和单词到期，复习一遍大约 ${Math.max(1, Math.ceil(reviewsToday / 3))} 分钟`
              : "今天没有到期的内容"}
          </p>
          <button type="button" className="btn btn-primary stat-btn" onClick={() => navigate("/review")}>
            开始复习
            <ArrowRight size={16} aria-hidden />
          </button>
        </section>

        <section className="card stat-card stats-pair" aria-label="学习记录">
          <div className="stats-pair-item">
            <div className="stat-head">
              <span className="stat-icon">
                <MessageSquareText size={20} aria-hidden />
              </span>
              <span className="stat-title">已学句子</span>
            </div>
            <p className="stat-number">
              {sentencesLearned}
              <span className="stat-unit">句</span>
            </p>
          </div>
          <div className="stats-pair-divider" />
          <div className="stats-pair-item">
            <div className="stat-head">
              <span className="stat-icon stat-icon-accent">
                <Flame size={20} aria-hidden />
              </span>
              <span className="stat-title">连续天数</span>
            </div>
            <p className="stat-number">
              {streakDays}
              <span className="stat-unit">天</span>
            </p>
          </div>
        </section>

        <section className="card map-card" aria-label="课程地图">
          <span className="stat-icon">
            <BookOpen size={20} aria-hidden />
          </span>
          <div className="map-card-text">
            <h2 className="stat-title">课程地图 · A1</h2>
            <p className="muted map-card-desc">
              已学 {learned} / {courseTotal} 课，其中已掌握 {counts.mastered} 课
            </p>
            <ProgressBar value={courseTotal ? learned / courseTotal : 0} label="A1 进度" />
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => navigate("/courses")}>
            查看课程
            <ArrowRight size={16} aria-hidden />
          </button>
        </section>
      </div>
    </div>
  );
}
