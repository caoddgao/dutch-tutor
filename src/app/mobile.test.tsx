import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { deviceSettings } from "../settings/settings";
import { fsPackBackend, testServices } from "../test/services";

const ANDROID = "Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36";
let mobile = true;
const listeners = new Set<() => void>();

beforeEach(() => {
  mobile = true;
  listeners.clear();
  window.localStorage.clear();
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("max-width") ? mobile : true,
    addEventListener: (_: string, fn: () => void) => {
      if (query.includes("max-width")) listeners.add(fn);
    },
    removeEventListener: (_: string, fn: () => void) => {
      if (query.includes("max-width")) listeners.delete(fn);
    },
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("Android startup theme", () => {
  it("uses light only as the Android default and respects every explicit preference", () => {
    expect(deviceSettings({}, ANDROID).theme).toBe("light");
    expect(deviceSettings({}, "Windows NT 10.0").theme).toBe("system");
    for (const theme of ["light", "dark", "system"]) {
      expect(deviceSettings({ theme }, ANDROID).theme).toBe(theme);
    }
  });

  it("applies light with a dark system, then restores the user's saved choice on restart", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ANDROID);
    const { services, settingsData } = testServices();
    window.location.hash = "#/settings";
    const first = await act(async () => render(<App services={services} />));
    expect(document.documentElement.dataset.theme).toBe("light");
    await act(async () => fireEvent.click(screen.getByRole("radio", { name: "深色" })));
    expect(settingsData.theme).toBe("dark");
    first.unmount();
    await act(async () => render(<App services={services} />));
    expect(document.documentElement.dataset.theme).toBe("dark");
    vi.restoreAllMocks();
  });
});

describe("mobile access", () => {
  it.each(["/settings/recording", "/settings/recording/NN21"])(
    "redirects a direct %s URL before mounting recording tools",
    async (path) => {
      window.location.hash = `#${path}`;
      const { services } = testServices();
      const exportText = vi.spyOn(services.dataFiles, "exportText");
      await act(async () => render(<App services={services} />));
      await waitFor(() => expect(window.location.hash).toBe("#/settings"));
      expect(screen.queryByRole("link", { name: "进入录音模式" })).toBeNull();
      expect(exportText).not.toHaveBeenCalled();
      expect(screen.queryByText("学习数据")).toBeNull();
      expect(screen.queryByText("内容报错")).toBeNull();
      expect(screen.getByText("已就绪 · 7 课")).toBeTruthy();
      expect(screen.queryByRole("button", { name: /导入/ })).toBeNull();
    },
  );

  it.each(["/settings/backup", "/settings/export", "/settings/reports"])(
    "does not expose desktop exports via %s",
    async (path) => {
      window.location.hash = `#${path}`;
      const { services } = testServices();
      await act(async () => render(<App services={services} />));
      await waitFor(() => expect(window.location.hash).toBe("#/"));
      expect(screen.queryByRole("button", { name: /导出/ })).toBeNull();
    },
  );

  it("guards the mounted desktop route when the window becomes narrow", async () => {
    mobile = false;
    window.location.hash = "#/settings/recording";
    const { services } = testServices();
    await act(async () => render(<App services={services} />));
    expect(screen.getByRole("heading", { name: "录音模式", level: 2 })).toBeTruthy();
    await act(async () => {
      mobile = true;
      listeners.forEach((fn) => fn());
    });
    await waitFor(() => expect(window.location.hash).toBe("#/settings"));
  });

  it("shows read-only guidance for a missing or damaged built-in pack", async () => {
    window.location.hash = "#/settings";
    const { services } = testServices({ pack: fsPackBackend(null) });
    await act(async () => render(<App services={services} />));
    expect(screen.getByText("暂无资料包")).toBeTruthy();
    expect(screen.getByText(/请安装包含完整资料的新版应用/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /导入/ })).toBeNull();
  });
});
