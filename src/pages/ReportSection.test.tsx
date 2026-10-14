import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ServicesContext } from "../servicesContext";
import { addReport } from "../storage/feedback";
import type { SqlDb } from "../storage/db";
import { memoryDataFiles, testServices } from "../test/services";
import { ReportSection } from "./ReportSection";

const word = { type: "word" as const, id: "w_huis", lessonId: "P05", nl: "huis", zh: "房子" };
const sentence = { type: "sentence" as const, id: "NN21-S02", lessonId: "NN21", nl: "Goedemorgen!", zh: "早上好！" };

async function setup(seed: (db: SqlDb) => Promise<void>) {
  const files = memoryDataFiles();
  const t = testServices({ dataFiles: files });
  await seed(t.db);
  // a recording-mode mark is not a report
  await t.db.execute(
    "INSERT INTO feedback (target_type, target_id, category) VALUES ('sentence', 'P01-S01', 'unnatural')",
  );
  await act(async () => {
    render(
      <ServicesContext.Provider value={t.services}>
        <ReportSection />
      </ServicesContext.Provider>,
    );
  });
  return { ...t, files };
}

describe("ReportSection", () => {
  it("exports the reports not exported yet, then counts them as done", async () => {
    const { files, raw } = await setup(async (db) => {
      await addReport(db, sentence, "translation", "应该是早安", new Date("2026-10-14T08:00:00Z"));
      await addReport(db, word, "audio", "", new Date("2026-10-14T09:00:00Z"));
    });
    expect(screen.getByText("2 条还没导出")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "导出报错" }));
    });
    expect(files.saved).toHaveLength(1);
    expect(files.saved[0].name).toMatch(/^Dutch-Tutor-内容报错-\d{4}-\d{2}-\d{2}\.json$/);
    const file = JSON.parse(files.saved[0].text);
    expect(file).toMatchObject({ format: "dutch-tutor-reports", version: 1, count: 2 });
    expect(file.reports).toEqual([
      {
        lesson: "NN21",
        type: "sentence",
        id: "NN21-S02",
        nl: "Goedemorgen!",
        zh: "早上好！",
        reason: "translation",
        reason_zh: "翻译不对",
        note: "应该是早安",
        reported_at: "2026-10-14T08:00:00.000Z",
      },
      {
        lesson: "P05",
        type: "word",
        id: "w_huis",
        nl: "huis",
        zh: "房子",
        reason: "audio",
        reason_zh: "音频有问题",
        note: "",
        reported_at: "2026-10-14T09:00:00.000Z",
      },
    ]);
    expect(screen.getByRole("status").textContent).toMatch(/已导出 2 条/);
    expect(await screen.findByText("2 条都已导出")).toBeTruthy();
    // the recording-mode mark is left alone
    expect(raw.prepare("SELECT COUNT(*) AS n FROM feedback WHERE exported_at IS NULL").get()).toEqual({ n: 1 });

    // everything exported: the button offers the whole list again
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "重新导出全部" }));
    });
    expect(JSON.parse(files.saved[1].text).count).toBe(2);
  });

  it("nothing to export yet", async () => {
    await setup(async () => undefined);
    expect(screen.getByText("还没有报错")).toBeTruthy();
    expect((screen.getByRole("button", { name: "导出报错" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("only new reports go into the next file", async () => {
    const { files, db, services } = await setup(async (d) => {
      await addReport(d, sentence, "other", "");
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "导出报错" }));
    });
    await addReport(db, word, "dutch", "");
    cleanup();
    await act(async () => {
      render(
        <ServicesContext.Provider value={services}>
          <ReportSection />
        </ServicesContext.Provider>,
      );
    });
    expect(screen.getByText("1 条还没导出")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "导出报错" }));
    });
    const second = JSON.parse(files.saved[1].text);
    expect(second.count).toBe(1);
    expect(second.reports[0]).toMatchObject({ id: "w_huis", reason_zh: "荷兰语不自然" });
  });
});
