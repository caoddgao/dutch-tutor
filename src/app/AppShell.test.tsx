import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../App";
import type { SettingsStore } from "../storage/settingsStore";

function memoryStore(initial: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { ...initial };
  const store: SettingsStore = {
    load: async () => ({ ...data }),
    save: async (key, value) => {
      data[key] = value;
    },
  };
  return { data, store };
}

describe("AppShell", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.location.hash = "#/";
  });

  it("shows all navigation entries in Chinese", async () => {
    const { store } = memoryStore();
    await act(async () => {
      render(<App store={store} />);
    });
    for (const label of ["首页", "课程", "复习", "发音练习", "模拟考试", "设置"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("EN toggle hides English globally and is saved", async () => {
    const { data, store } = memoryStore();
    await act(async () => {
      render(<App store={store} />);
    });
    const toggle = screen.getByRole("switch", { name: "显示英文释义" });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    await act(async () => {
      fireEvent.click(toggle);
    });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(document.documentElement.dataset.showEn).toBe("false");
    expect(data.showEnglish).toBe(false);
  });

  it("restores the saved English setting on start", async () => {
    const { store } = memoryStore({ showEnglish: false });
    await act(async () => {
      render(<App store={store} />);
    });
    expect(screen.getByRole("switch", { name: "显示英文释义" }).getAttribute("aria-checked")).toBe("false");
  });
});
