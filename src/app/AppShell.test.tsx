import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../App";
import { testServices } from "../test/services";

describe("AppShell", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.location.hash = "#/";
  });

  it("shows all navigation entries in Chinese", async () => {
    const { services } = testServices();
    await act(async () => {
      render(<App services={services} />);
    });
    for (const label of ["首页", "课程", "复习", "发音练习", "模拟考试", "设置"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("EN toggle hides English globally and is saved", async () => {
    const { settingsData: data, services } = testServices();
    await act(async () => {
      render(<App services={services} />);
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
    const { services } = testServices({ settingsData: { showEnglish: false } });
    await act(async () => {
      render(<App services={services} />);
    });
    expect(screen.getByRole("switch", { name: "显示英文释义" }).getAttribute("aria-checked")).toBe("false");
  });
});
