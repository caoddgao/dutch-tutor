import { act, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../App";
import { completeLesson, markStudyDay, savePosition } from "../storage/learning";
import { fsPackBackend, testServices } from "../test/services";
import { greetingFor } from "./greeting";

async function renderAt(hash: string, seed?: (t: ReturnType<typeof testServices>) => Promise<void>, over = {}) {
  window.location.hash = hash;
  const t = testServices(over);
  if (seed) await seed(t);
  await act(async () => {
    render(<App services={t.services} />);
  });
  return t;
}

describe("CoursesPage", () => {
  beforeEach(() => window.localStorage.clear());

  it("shows level tabs with A2–B2 coming soon, and the no-lock note", async () => {
    await renderAt("#/courses");
    const a1 = await screen.findByRole("tab", { name: "A1" });
    expect(a1.getAttribute("aria-selected")).toBe("true");
    for (const level of ["A2", "B1", "B2"]) {
      const tab = screen.getByRole("tab", { name: new RegExp(`^${level}`) });
      expect((tab as HTMLButtonElement).disabled).toBe(true);
      expect(within(tab).getByText("即将推出")).toBeTruthy();
    }
    expect(screen.getByText("所有课程随时可学，不锁课")).toBeTruthy();
  });

  it("real lessons with statuses; exactly one recommended; cards open the lesson", async () => {
    await renderAt("#/courses", async ({ db }) => {
      await completeLesson(db, "P01", [{ id: "P01-S01", type: "sentence" }]);
    });
    await screen.findByText("Bij de bakker");
    const recommended = document.querySelectorAll(".lesson-card.is-recommended");
    expect(recommended).toHaveLength(1);
    expect(within(recommended[0] as HTMLElement).getByText("P02")).toBeTruthy();
    expect(screen.getAllByText("学过").length).toBe(1);
    expect(screen.getByRole("link", { name: "第 21 课 Bij de bakker" }).getAttribute("href")).toBe("#/lesson/NN21");
    expect(screen.getByRole("link", { name: "复习P01" }).getAttribute("href")).toBe("#/review/lesson/P01");
    expect(screen.getByText("资料包里还没有：第 23–65 课")).toBeTruthy();
  });

  it("without the pack, main lessons say they need it", async () => {
    await renderAt("#/courses", undefined, { pack: fsPackBackend(null) });
    expect((await screen.findAllByText("需要资料包")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Bij de bakker")).toBeNull();
    expect(screen.getByText(/第 21–65 课的课文/)).toBeTruthy();
  });
});

describe("HomePage", () => {
  beforeEach(() => window.localStorage.clear());

  it("recommends the first lesson when nothing was studied yet", async () => {
    await renderAt("#/");
    const cont = await screen.findByRole("region", { name: "继续学习" });
    expect(within(cont).getByText("推荐下一课")).toBeTruthy();
    expect(within(cont).getByText("a · e · i")).toBeTruthy();
    expect(within(cont).getByRole("button", { name: "开始学" })).toBeTruthy();
  });

  it("continues the lesson in progress and shows real counts", async () => {
    await renderAt("#/", async ({ db }) => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      await completeLesson(
        db,
        "NN21",
        [
          { id: "NN21-S01", type: "sentence" },
          { id: "NN21-S02", type: "sentence" },
          { id: "w_brood", type: "word" },
        ],
        yesterday,
      );
      await markStudyDay(db, yesterday);
      await savePosition(db, "NN22", 1, 2);
      await markStudyDay(db, new Date());
    });
    const cont = await screen.findByRole("region", { name: "继续学习" });
    expect(within(cont).getByText("Mijn buurman")).toBeTruthy();
    expect(within(cont).getByText("第 2 步 · 逐句学")).toBeTruthy();
    expect(within(cont).getByText("3 / 6 句")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "今日复习" })).getByText("3")).toBeTruthy();
    const stats = screen.getByRole("region", { name: "学习记录" });
    // 2 sentences learned, 2-day streak (yesterday and today)
    expect(within(stats).getAllByText("2")).toHaveLength(2);
    expect(within(screen.getByRole("region", { name: "课程地图" })).getByText(/已学 1 \/ 50 课/)).toBeTruthy();
  });

  it("asks for the pack when the phonics lessons are done and there is no pack", async () => {
    await renderAt(
      "#/",
      async ({ db }) => {
        await completeLesson(db, "P01", []);
        await completeLesson(db, "P02", []);
      },
      { pack: fsPackBackend(null) },
    );
    const cont = await screen.findByRole("region", { name: "继续学习" });
    expect(within(cont).getByText("导入资料包，开始学正课")).toBeTruthy();
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
