import { BookOpen, ClipboardCheck, House, Mic, Repeat2, Settings, type LucideIcon } from "lucide-react";

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

export function titleForPath(pathname: string): string {
  if (pathname.startsWith("/lesson/")) return "上课";
  const item = NAV_ITEMS.find((n) => n.path === pathname);
  return item?.label ?? "首页";
}
