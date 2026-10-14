import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { RecordingStore } from "../audio/recordings";
import type { Assessment } from "../pronunciation/context";
import { completeLesson } from "../storage/learning";
import { testServices } from "../test/services";

const azure = vi.hoisted(() => ({
  assess: vi.fn(),
}));

vi.mock("../pronunciation/AzureProvider", async () => {
  const { AzureContext } = await import("../pronunciation/context");
  return {
    AzureProvider: ({ children }: { children: ReactNode }) => (
      <AzureContext.Provider
        value={{
          status: { region: "westeurope", has_key: true, enabled: true, month: "2026-10", month_seconds: 0 },
          save: vi.fn(),
          clearKey: vi.fn(),
          testConnection: vi.fn(),
          assess: azure.assess,
        }}
      >
        {children}
      </AzureContext.Provider>
    ),
  };
});

vi.mock("../audio/recorder", async (original) => ({
  ...(await original<typeof import("../audio/recorder")>()),
  startRecording: async () => ({
    stop: async () => ({ blob: new Blob(["take"], { type: "audio/webm" }), mime: "audio/webm", duration: 1.5 }),
    cancel: () => undefined,
  }),
}));

afterEach(() => {
  azure.assess.mockReset();
  vi.unstubAllGlobals();
});

const result = (total: number): Assessment => ({
  total,
  accuracy: 80,
  fluency: 70,
  completeness: 100,
  low_words: [{ word: "Goedemorgen", accuracy: 41 }],
  month_seconds: 30,
});

async function open() {
  const t = testServices();
  await completeLesson(t.db, "NN21", [], new Date("2026-10-13T09:00:00Z"));
  window.location.hash = "#/practice";
  await act(async () => {
    render(<App services={t.services} />);
  });
  return { t, card: await screen.findByRole("region", { name: "练习卡" }) };
}

describe("PracticePage with pronunciation scoring", () => {
  it("scores each new take against the sentence and keeps the score with the take", async () => {
    azure.assess.mockResolvedValueOnce(result(74));
    const { t, card } = await open();
    fireEvent.click(within(card).getByRole("button", { name: "录音" }));
    fireEvent.click(await within(card).findByRole("button", { name: "停止录音" }));

    expect(await within(card).findByText("刚才这次的评分")).toBeTruthy();
    expect(azure.assess).toHaveBeenCalledWith(expect.any(Blob), "Goedemorgen!");
    expect(await within(card).findByText("74 分")).toBeTruthy();
    expect(within(card).getByText("需要多练的词")).toBeTruthy();
    const row = t.raw.prepare("SELECT assessment FROM recordings WHERE audio_id = 'NN21-S01'").get() as {
      assessment: string;
    };
    expect(JSON.parse(row.assessment)).toMatchObject({ total: 74, low_words: [{ word: "Goedemorgen" }] });
    expect(row.assessment).not.toContain("month_seconds");
  });

  it("shows an earlier score, offers to score an unscored take and explains a failure", async () => {
    const t = testServices();
    await completeLesson(t.db, "NN21", [], new Date("2026-10-13T09:00:00Z"));
    const store = new RecordingStore(t.services.db, t.services.recordingFiles);
    const old = await store.savePractice("NN21-S01", { blob: new Blob(["a"]), mime: "audio/webm", duration: 2 });
    await store.saveAssessment(old.id, result(61));
    window.location.hash = "#/practice";
    await act(async () => {
      render(<App services={t.services} />);
    });
    const card = await screen.findByRole("region", { name: "练习卡" });
    expect(await within(card).findByText("最近一次的评分")).toBeTruthy();
    expect(within(card).getAllByText("61")).toBeTruthy();

    // a take from the lesson, not scored yet
    await store.savePractice("NN21-S02", { blob: new Blob(["b"]), mime: "audio/webm", duration: 2 });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, blob: async () => new Blob(["b"]) })),
    );
    azure.assess.mockRejectedValueOnce({ code: "rate_limited", retry_after: 30 });
    fireEvent.click(screen.getByRole("button", { name: /Goedemorgen, mevrouw\./ }));
    const next = screen.getByRole("region", { name: "练习卡" });
    fireEvent.click(await within(next).findByRole("button", { name: "给这次录音评分" }));
    expect((await within(next).findByRole("alert")).textContent).toBe("请求太频繁，请 30 秒后再评分。");

    azure.assess.mockResolvedValueOnce(result(88));
    fireEvent.click(within(next).getByRole("button", { name: "再评一次" }));
    await waitFor(() => expect(within(next).getByText("88 分")).toBeTruthy());
  });
});
