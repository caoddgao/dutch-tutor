import { Navigate, Outlet } from "react-router";
import { useMobileLayout } from "./useMobileLayout";

export function DesktopOnlyRoute() {
  return useMobileLayout() ? <Navigate to="/settings" replace /> : <Outlet />;
}
