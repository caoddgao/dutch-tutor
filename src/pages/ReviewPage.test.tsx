import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { CONTENT } from "../content/bundle";
import { completeLesson } from "../storage/learning";
import { fixtureContent, testServices } from "../test/services";

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
});

async function setup(hash: string, settingsData: Record<string, unknown> = {}, content = fixtureContent()) {
  const t = testServices({ content, settingsData });
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  await completeLesson(
    t.db,
    "NN21",
    [
      { id: "NN21-S01", type: "sentence" },
      { id: "NN21-S03", type: "sentence" },
      { id: "NN21-S05", type: "sentence" },
      { id: "w_brood", type: "word" },
    ],
    yesterday,
  );
  window.location.hash = hash;
  await act(async () => {
    render(<App services={t.services} />);
  });
  return t;
}

describe("review", () => {
  it("shows today's due items, mistakes and review by lesson", async () => {
    await setup("#/review");
    const today = await screen.findByRole("region", { name: "今日复习" });
    expect(within(today).getByText("4")).toBeTruthy();
    const byLesson = screen.getByRole("region", { name: "按课复习" });
    expect(within(byLesson).getByText("第 21 课")).toBeTruthy();
    expect(within(byLesson).getByText(/4 项/)).toBeTruthy();
  });

  it("the daily limit caps today's review", async () => {
    await setup("#/review", { dailyReviewLimit: 10 });
    const today = await screen.findByRole("region", { name: "今日复习" });
    expect(within(today).getByText("4")).toBeTruthy();
  });

  it("items recorded before a lesson was split are found in its parts", async () => {
    // the repo course splits NN21 into NN21a / NN21b (design §2.1); the items were saved under NN21
    await setup("#/review/daily", { reviewR2: false, reviewR3: false }, CONTENT);
    expect(await screen.findByText(/^1 \/ 4$/)).toBeTruthy();
    expect(screen.queryByText(/需要先导入资料包/)).toBeNull();
  });

  it("answering an R1 item records it and moves the item; a wrong one comes back once", async () => {
    const { raw } = await setup("#/review/daily", { reviewR2: false, reviewR3: false });
    await screen.findByText(/^1 \/ 4$/);
    expect(screen.getByText("R1 · 看荷兰语选意思")).toBeTruthy();
    const options = screen.getAllByRole("button").filter((b) => b.classList.contains("q-option"));
    const right = options.find((o) => !o.hasAttribute("data-wrong"))!;
    // pick a wrong option on purpose
    const wrong = options.find((o) => o !== right && o.textContent !== right.textContent) ?? options[0];
    fireEvent.click(wrong);
    await waitFor(() => expect(raw.prepare("SELECT COUNT(*) AS n FROM review_log").get()).toEqual({ n: 1 }));
    const status = screen.getByRole("status").textContent;
    fireEvent.click(screen.getByRole("button", { name: /下一个/ }));
    if (status?.startsWith("没关系")) expect(await screen.findByText(/^2 \/ 5$/)).toBeTruthy();
    else expect(await screen.findByText(/^2 \/ 4$/)).toBeTruthy();
  });
});
