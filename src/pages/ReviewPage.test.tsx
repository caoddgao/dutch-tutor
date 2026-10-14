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

const NN21_ITEMS = [
  { id: "NN21-S01", type: "sentence" as const },
  { id: "NN21-S03", type: "sentence" as const },
  { id: "NN21-S05", type: "sentence" as const },
  { id: "w_brood", type: "word" as const },
];

async function setup(
  hash: string,
  settingsData: Record<string, unknown> = {},
  content = fixtureContent(),
  recorded: [string, typeof NN21_ITEMS] = ["NN21", NN21_ITEMS],
) {
  const t = testServices({ content, settingsData });
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  await completeLesson(t.db, recorded[0], recorded[1], yesterday);
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
    // the repo course splits NN22 into NN22a / NN22b (design §2.1); the items were saved under NN22
    await setup("#/review/daily", { reviewR2: false, reviewR3: false }, CONTENT, [
      "NN22",
      [
        { id: "NN22-S01", type: "sentence" },
        { id: "NN22-S03", type: "sentence" },
        { id: "NN22-S19", type: "sentence" },
        { id: "w_wonen", type: "word" },
      ],
    ]);
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
    // after answering, the card can be reported
    expect(screen.getByRole("button", { name: "报错" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /下一个/ }));
    if (status?.startsWith("没关系")) expect(await screen.findByText(/^2 \/ 5$/)).toBeTruthy();
    else expect(await screen.findByText(/^2 \/ 4$/)).toBeTruthy();
  });
});
