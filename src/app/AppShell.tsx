import { useEffect } from "react";
import { player } from "../audio/player";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { useContent } from "../content/context";
import { useSettings } from "../settings/context";
import { useMobileLayout } from "./useMobileLayout";
import { MOBILE_NAV_ITEMS, NAV_ITEMS, titleForPath } from "./nav";
import "./AppShell.css";

export function AppShell() {
  const mobile = useMobileLayout();
  const { pathname, search } = useLocation();
  // Stop the page being left before the next page starts its own automatic playback.
  useEffect(() => () => player.stop(), [pathname, search]);
  const { settings, update } = useSettings();
  const { packUpdate } = useContent();
  const mainItems = NAV_ITEMS.filter((n) => n.path !== "/settings");
  const settingsItem = NAV_ITEMS.find((n) => n.path === "/settings")!;

  const renderLink = (item: (typeof NAV_ITEMS)[number]) => {
    const Icon = item.icon;
    return (
      <NavLink
        key={item.path}
        to={item.path}
        end={item.path === "/"}
        className={({ isActive }) =>
          `nav-link${
            isActive ||
            (item.path === "/courses" && pathname.startsWith("/lesson/")) ||
            (item.path === "/more" && (pathname.startsWith("/settings") || pathname === "/exam"))
              ? " active"
              : ""
          }`
        }
        title={item.label}
      >
        <Icon size={20} strokeWidth={2} aria-hidden />
        <span className="nav-label">{item.label}</span>
      </NavLink>
    );
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/icon.svg" alt="" width={36} height={36} />
          <span className="brand-name">Dutch Tutor</span>
        </div>
        <nav className="nav" aria-label="主导航">
          {mainItems.map(renderLink)}
          <div className="nav-spacer" />
          {renderLink(settingsItem)}
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-inner">
            <h1 className="topbar-title">{titleForPath(pathname)}</h1>
            <div className="topbar-actions">
              <button
                type="button"
                className="en-toggle"
                role="switch"
                aria-checked={settings.showEnglish}
                aria-label="显示英文释义"
                title={settings.showEnglish ? "隐藏英文释义" : "显示英文释义"}
                onClick={() => update("showEnglish", !settings.showEnglish)}
              >
                <span className="desktop-only">EN</span>
                <span className="mobile-only">英文</span>
              </button>
            </div>
          </div>
        </header>
        <main className="content">
          {!mobile && packUpdate && pathname !== "/settings" && (
            <div className="notice notice-accent shell-notice" role="status">
              <span>资料包有新版本，重新导入后才能看到新内容。</span>
              <Link to="/settings" className="btn btn-accent btn-small">
                去重新导入
              </Link>
            </div>
          )}
          {/* keyed by route: each page fades in when it opens */}
          <div key={pathname} className="page">
            <Outlet />
          </div>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="手机导航">
        {MOBILE_NAV_ITEMS.map(renderLink)}
      </nav>
    </div>
  );
}
