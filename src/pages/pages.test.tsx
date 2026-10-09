import { act, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../App";
import { testServices } from "../test/services";
import { greetingFor } from "./greeting";

async function renderAt(hash: string) {
  window.location.hash = hash;
  await act(async () => {
    render(<App services={testServices().services} />);
  });
}

describe("CoursesPage", () => {
  beforeEach(() => window.localStorage.clear());

  it("shows level tabs with A2–B2 coming soon, and the no-lock note", async () => {
    await renderAt("#/courses");
    const a1 = screen.getByRole("tab", { name: "A1" });
    expect(a1.getAttribute("aria-selected")).toBe("true");
    for (const level of ["A2", "B1", "B2"]) {
      const tab = screen.getByRole("tab", { name: new RegExp(`^${level}`) });
      expect((tab as HTMLButtonElement).disabled).toBe(true);
      expect(within(tab).getByText("即将推出")).toBeTruthy();
    }
    expect(screen.getByText("所有课程随时可学，不锁课")).toBeTruthy();
  });

  it("highlights exactly one recommended lesson", async () => {
    await renderAt("#/courses");
    const recommended = document.querySelectorAll(".lesson-card.is-recommended");
    expect(recommended).toHaveLength(1);
    expect(within(recommended[0] as HTMLElement).getByText("推荐")).toBeTruthy();
    expect(screen.getAllByText("已掌握").length).toBeGreaterThan(0);
    expect(screen.getAllByText("学过").length).toBeGreaterThan(0);
    expect(screen.getAllByText("未学").length).toBeGreaterThan(0);
  });
});

describe("HomePage", () => {
  it("shows continue card, today's reviews and study stats", async () => {
    await renderAt("#/");
    const cont = screen.getByRole("region", { name: "继续学习" });
    expect(within(cont).getByRole("button", { name: "接着学" })).toBeTruthy();
    expect(within(cont).getByRole("progressbar")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "今日复习" })).getByText("18")).toBeTruthy();
    const stats = screen.getByRole("region", { name: "学习记录" });
    expect(within(stats).getByText("已学句子")).toBeTruthy();
    expect(within(stats).getByText("连续天数")).toBeTruthy();
  });
});

describe("greetingFor", () => {
  it("greets by time of day", () => {
    expect(greetingFor(8).nl).toBe("Goedemorgen!");
    expect(greetingFor(14).nl).toBe("Goedemiddag!");
    expect(greetingFor(21).nl).toBe("Goedenavond!");
    expect(greetingFor(2).nl).toBe("Goedenavond!");
  });
});
