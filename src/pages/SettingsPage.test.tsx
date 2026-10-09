import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../App";
import { testServices } from "../test/services";

async function renderSettings(initial: Record<string, unknown> = {}) {
  const mem = testServices({ settingsData: initial });
  await act(async () => {
    render(<App services={mem.services} />);
  });
  return { data: mem.settingsData, ...mem };
}

describe("SettingsPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.location.hash = "#/settings";
  });

  it("switches theme immediately and saves it", async () => {
    const { data } = await renderSettings();
    await act(async () => {
      fireEvent.click(screen.getByRole("radio", { name: "深色" }));
    });
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(data.theme).toBe("dark");
    await act(async () => {
      fireEvent.click(screen.getByRole("radio", { name: "浅色" }));
    });
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("font sliders apply at once and are saved", async () => {
    const { data } = await renderSettings();
    await act(async () => {
      fireEvent.change(screen.getByLabelText("荷兰语字号"), { target: { value: "1.3" } });
    });
    expect(document.documentElement.style.getPropertyValue("--scale-nl")).toBe("1.3");
    expect(data.scaleNl).toBe(1.3);
    expect(screen.getByText("130%")).toBeTruthy();
  });

  it("restores saved values on start", async () => {
    await renderSettings({ scaleZh: 1.2, playbackRate: 0.75, theme: "dark" });
    expect(screen.getByText("120%")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "慢速 0.75×" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "深色" }).getAttribute("aria-checked")).toBe("true");
  });
});
