import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { RecordingStore } from "../audio/recordings";
import { completeLesson, savePosition } from "../storage/learning";
import { fsPackBackend, testServices } from "../test/services";

vi.mock("../audio/recorder", async (original) => ({
  ...(await original<typeof import("../audio/recorder")>()),
  startRecording: async () => ({
    stop: async () => ({ blob: new Blob(["take"], { type: "audio/webm" }), mime: "audio/webm", duration: 1.5 }),
    cancel: () => undefined,
  }),
}));

type Services = ReturnType<typeof testServices>;

async function renderAt(hash: string, t: Services) {
  window.location.hash = hash;
  await act(async () => {
    render(<App services={t.services} />);
  });
}

/** P01 and P02 studied, NN21 studied last; P03 only opened (still "new"). */
async function studied(over: Parameters<typeof testServices>[0] = {}) {
  const t = testServices(over);
  await completeLesson(t.db, "P01", [], new Date("2026-10-10T09:00:00Z"));
  await completeLesson(t.db, "NN21", [], new Date("2026-10-13T09:00:00Z"));
  await completeLesson(t.db, "P02", [], new Date("2026-10-11T09:00:00Z"));
  await savePosition(t.db, "P03", 1, 2, new Date("2026-10-14T09:00:00Z"));
  return t;
}

const list = () => screen.getByRole("list", { name: "句子" });
const rows = () => within(list()).getAllByRole("button");
const lessonSelect = () => screen.getByRole("combobox", { name: "课程" }) as HTMLSelectElement;
const card = () => screen.getByRole("region", { name: "练习卡" });

describe("PracticePage", () => {
  beforeEach(() => window.localStorage.clear());

  it("starts on the lesson studied last and groups all studied lessons in course order", async () => {
    await renderAt("#/practice", await studied());
    await screen.findByRole("region", { name: "练习卡" });
    expect(lessonSelect().value).toBe("NN21");
    expect(within(card()).getByText("第 21 课 · 在面包店")).toBeTruthy();
    expect(within(card()).getByText("Goedemorgen!")).toBeTruthy();
    // number words read aloud are not sentences to shadow
    expect(within(list()).queryByText("vier")).toBeNull();

    fireEvent.change(lessonSelect(), { target: { value: "all" } });
    const headings = within(list()).getAllByRole("heading");
    expect(headings.map((h) => h.textContent)).toEqual([
      "P01 · 短元音 a、e、i",
      "P02 · 长元音 aa、ee",
      "第 21 课 · 在面包店",
    ]);
    expect(within(list()).queryByText("Pas op, een mug!")).toBeNull();
  });

  it("filters by lesson, opens a sentence and picks a random one within the filter", async () => {
    await renderAt("#/practice", await studied());
    await screen.findByRole("region", { name: "练习卡" });
    fireEvent.change(lessonSelect(), { target: { value: "P02" } });
    expect(rows()).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: /Twee thee, graag\./ }));
    expect(within(card()).getByText("P02 · 长元音 aa、ee")).toBeTruthy();
    expect(screen.getByText("第 4 / 6 句")).toBeTruthy();

    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByRole("button", { name: /随机来一句/ }));
      expect(within(card()).getByText("P02 · 长元音 aa、ee")).toBeTruthy();
    }
  });

  it("shows only hard sentences, and the empty state once none are left", async () => {
    await renderAt("#/practice", await studied());
    await screen.findByRole("region", { name: "练习卡" });
    fireEvent.click(screen.getByRole("button", { name: "收进难句" }));
    fireEvent.click(screen.getByRole("switch", { name: "只看我的难句" }));
    expect(rows()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "已收进难句" }));
    expect(screen.getByRole("heading", { name: "还没有难句" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "看全部句子" }));
    expect(rows().length).toBeGreaterThan(1);
  });

  it("keeps starred sentences in the database for the next visit", async () => {
    const t = await studied();
    await renderAt("#/practice", t);
    await screen.findByRole("region", { name: "练习卡" });
    fireEvent.click(screen.getByRole("button", { name: "收进难句" }));
    await waitFor(() =>
      expect(t.raw.prepare("SELECT sentence_id FROM hard_sentences").all()).toEqual([{ sentence_id: "NN21-S01" }]),
    );
    cleanup();

    await renderAt("#/practice", t);
    await screen.findByRole("region", { name: "练习卡" });
    expect(screen.getByRole("button", { name: "已收进难句" })).toBeTruthy();
    expect(within(list()).getAllByLabelText("难句")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "已收进难句" }));
    await waitFor(() => expect(t.raw.prepare("SELECT * FROM hard_sentences").all()).toEqual([]));
  });

  it("without scoring, points to the settings", async () => {
    await renderAt("#/practice", await studied());
    await screen.findByRole("region", { name: "练习卡" });
    expect(within(card()).queryByText("刚才这次的评分")).toBeNull();
    expect(within(card()).getByRole("link", { name: "去设置" }).getAttribute("href")).toBe("#/settings");
  });

  it("before any lesson is studied it sends the learner to the courses", async () => {
    await renderAt("#/practice", testServices());
    expect(await screen.findByRole("heading", { name: "还没有学过的课" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "去上第一课" }).getAttribute("href")).toBe("#/courses");
  });

  it("without the pack, studied book lessons are counted and own lessons stay", async () => {
    await renderAt("#/practice", await studied({ pack: fsPackBackend(null) }));
    await screen.findByRole("region", { name: "练习卡" });
    expect(lessonSelect().value).toBe("P02");
    expect(screen.getByText(/另有 1 课学过/)).toBeTruthy();
  });

  it("records takes shared with lesson shadowing, keeps the newest three and leaves reviews alone", async () => {
    const t = await studied();
    // a take made while shadowing NN21-S01 in the lesson
    const store = new RecordingStore(t.services.db, t.services.recordingFiles);
    await store.savePractice("NN21-S01", { blob: new Blob(["x"]), mime: "audio/webm", duration: 2.25 });
    const reviews = t.raw.prepare("SELECT COUNT(*) AS n FROM review_items").get();
    const progress = t.raw.prepare("SELECT * FROM lesson_progress ORDER BY lesson_id").all();
    await renderAt("#/practice", t);
    await screen.findByRole("region", { name: "练习卡" });
    const takes = () => within(card()).queryAllByRole("button", { name: /播放第 \d 次录音/ });
    await waitFor(() => expect(takes()).toHaveLength(1));
    expect(within(card()).getByText("2.3 秒")).toBeTruthy();

    for (let i = 0; i < 3; i++) {
      fireEvent.click(within(card()).getByRole("button", { name: "录音" }));
      fireEvent.click(await within(card()).findByRole("button", { name: "停止录音" }));
      await within(card()).findByRole("button", { name: "录音" });
    }
    await waitFor(() => expect(takes()).toHaveLength(3));
    expect(within(card()).getAllByText("刚才")).toHaveLength(3);
    expect(within(card()).queryByText("2.3 秒")).toBeNull();
    expect(within(card()).getByRole("group", { name: "对比播放" })).toBeTruthy();
    expect(t.raw.prepare("SELECT COUNT(*) AS n FROM recordings WHERE audio_id = 'NN21-S01'").get()).toEqual({ n: 3 });
    expect(t.raw.prepare("SELECT COUNT(*) AS n FROM review_items").get()).toEqual(reviews);
    expect(t.raw.prepare("SELECT * FROM lesson_progress ORDER BY lesson_id").all()).toEqual(progress);
  });

  it("switches between normal and slow playback", async () => {
    await renderAt("#/practice", await studied());
    await screen.findByRole("region", { name: "练习卡" });
    const slow = screen.getByRole("radio", { name: "慢速 0.75×" });
    fireEvent.click(slow);
    expect(slow.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "正常" }).getAttribute("aria-checked")).toBe("false");
  });
});
