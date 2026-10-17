import { BookOpen, ClipboardCheck, House, Mic, MoreHorizontal, Repeat2, Settings, type LucideIcon } from "lucide-react";

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { path: "/", label: "首页", icon: House },
  { path: "/courses", label: "课程", icon: BookOpen },
  { path: "/review", label: "复习", icon: Repeat2 },
  { path: "/practice", label: "发音练习", icon: Mic },
  { path: "/exam", label: "模拟考试", icon: ClipboardCheck },
  { path: "/settings", label: "设置", icon: Settings },
];

export const MOBILE_NAV_ITEMS: NavItem[] = [
  ...NAV_ITEMS.slice(0, 4),
  { path: "/more", label: "更多", icon: MoreHorizontal },
];

export function titleForPath(pathname: string): string {
  if (pathname === "/more") return "更多";
  if (pathname === "/settings/recording") return "录音模式";
  if (pathname.startsWith("/lesson/")) return "上课";
  if (pathname.startsWith("/review/")) return "复习";
  const item = NAV_ITEMS.find((n) => n.path === pathname);
  return item?.label ?? "首页";
}
