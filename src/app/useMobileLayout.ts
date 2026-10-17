import { useSyncExternalStore } from "react";

/** Keep route access and rendered controls aligned with the CSS mobile breakpoint. */
const QUERY = "(max-width: 600px)";
const matches = () => window.matchMedia?.(QUERY).matches ?? false;
const subscribe = (onChange: () => void) => {
  const media = window.matchMedia?.(QUERY);
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
};

export function useMobileLayout(): boolean {
  return useSyncExternalStore(subscribe, matches);
}
