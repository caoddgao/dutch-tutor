import { ChevronRight, ClipboardCheck, Settings } from "lucide-react";
import { Link } from "react-router";

export function MorePage() {
  return (
    <div className="more-page">
      <section className="immersive more-intro">
        <img src="/icon.svg" alt="" width={48} height={48} />
        <h2>每天学一点，慢慢说得更好</h2>
        <p>从一课到一段对话，按自己的节奏来。</p>
      </section>
      <div className="more-links">
        <Link to="/exam" className="card more-link">
          <span className="stat-icon stat-icon-accent">
            <ClipboardCheck size={22} aria-hidden />
          </span>
          <span className="more-link-text">
            <strong>模拟考试</strong>
            <span className="muted">口语与阅读，看看学得怎么样</span>
          </span>
          <ChevronRight size={20} aria-hidden />
        </Link>
        <Link to="/settings" className="card more-link">
          <span className="stat-icon">
            <Settings size={22} aria-hidden />
          </span>
          <span className="more-link-text">
            <strong>设置</strong>
            <span className="muted">主题、字号、播放与发音评分</span>
          </span>
          <ChevronRight size={20} aria-hidden />
        </Link>
      </div>
      <p className="more-note muted">学习进度保存在本机，手机和电脑各记各的。</p>
    </div>
  );
}
