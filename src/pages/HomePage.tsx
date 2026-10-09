import { ArrowRight, BookOpen, Flame, MessageSquareText, Play, Repeat2 } from "lucide-react";
import { useNavigate } from "react-router";
import { ProgressBar } from "../components/ProgressBar";
import { DEMO_CONTINUE, DEMO_SECTIONS, DEMO_STATS } from "../course/demoCourse";
import { countByStatus } from "../course/types";
import { greetingFor } from "./greeting";
import "./HomePage.css";

export function HomePage() {
  const navigate = useNavigate();
  const greeting = greetingFor(new Date().getHours());
  const allLessons = DEMO_SECTIONS.flatMap((s) => s.lessons);
  const current = allLessons.find((l) => l.id === DEMO_CONTINUE.lessonId)!;
  const counts = countByStatus(allLessons);
  const learned = counts.studied + counts.mastered;

  return (
    <div className="home">
      <header className="home-greeting">
        <p className="nl home-hello">{greeting.nl}</p>
        <p className="zh muted">{greeting.zh}，今天也学一点吧。</p>
      </header>

      <div className="home-grid">
        <section className="immersive continue-card" aria-label="继续学习">
          <div className="continue-top">
            <span className="continue-chip">继续学习</span>
            <span className="continue-code">A1 · {current.code}</span>
          </div>
          <div className="continue-title">
            <h2 className="nl continue-nl">{current.title.nl}</h2>
            <p className="zh continue-zh">{current.title.zh}</p>
            <p className="en continue-en">{current.title.en}</p>
          </div>
          <div className="continue-bottom">
            <div className="continue-progress">
              <div className="continue-progress-text">
                <span>{DEMO_CONTINUE.stepLabel}</span>
                <span>
                  {DEMO_CONTINUE.position} / {DEMO_CONTINUE.total} 句
                </span>
              </div>
              <ProgressBar value={current.progress} label="本课进度" />
            </div>
            <div className="continue-action">
              <button type="button" className="play-button" aria-label="接着学">
                <Play size={26} fill="currentColor" strokeWidth={0} aria-hidden />
              </button>
              <span className="continue-action-label">接着学</span>
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
            {DEMO_STATS.reviewsDueToday}
            <span className="stat-unit">项</span>
          </p>
          <p className="muted stat-desc">
            句子和单词到期，复习一遍大约 {Math.ceil(DEMO_STATS.reviewsDueToday / 3)} 分钟
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
              {DEMO_STATS.sentencesLearned}
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
              {DEMO_STATS.streakDays}
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
              已学 {learned} / {allLessons.length} 课，其中已掌握 {counts.mastered} 课
            </p>
            <ProgressBar value={learned / allLessons.length} label="A1 进度" />
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
