import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ServicesContext } from "../servicesContext";
import { testServices } from "../test/services";
import { ReportButton } from "./ReportButton";

const TARGET = { type: "sentence" as const, id: "NN21-S02", lessonId: "NN21", nl: "Goedemorgen!", zh: "早上好！" };

async function setup() {
  const t = testServices();
  await act(async () => {
    render(
      <ServicesContext.Provider value={t.services}>
        <ReportButton target={TARGET} />
      </ServicesContext.Provider>,
    );
  });
  return t;
}

describe("ReportButton", () => {
  it("records a reason and an optional note with what the learner saw", async () => {
    const { raw } = await setup();
    fireEvent.click(screen.getByRole("button", { name: "报错" }));
    const dialog = screen.getByRole("dialog", { name: "报告内容问题" });
    expect(dialog.textContent).toContain("Goedemorgen!");
    const submit = screen.getByRole("button", { name: "提交" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(screen.getAllByRole("radio").map((r) => r.parentElement?.textContent)).toEqual([
      "翻译不对",
      "荷兰语不自然",
      "音频有问题",
      "其他",
    ]);
    fireEvent.click(screen.getByLabelText("翻译不对"));
    fireEvent.change(screen.getByLabelText(/补充说明/), { target: { value: "  应该是“早安”  " } });
    await act(async () => {
      fireEvent.click(submit);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "已报错" })).toBeTruthy();
    expect(
      raw.prepare("SELECT target_type, target_id, category, note, lesson_id, nl, zh, exported_at FROM feedback").all(),
    ).toEqual([
      {
        target_type: "sentence",
        target_id: "NN21-S02",
        category: "translation",
        note: "应该是“早安”",
        lesson_id: "NN21",
        nl: "Goedemorgen!",
        zh: "早上好！",
        exported_at: null,
      },
    ]);
  });

  it("closes with Esc or 取消 without saving, and keeps keys away from the page behind", async () => {
    const { raw } = await setup();
    const onWindowKey = vi.fn();
    window.addEventListener("keydown", onWindowKey);
    fireEvent.click(screen.getByRole("button", { name: "报错" }));
    fireEvent.keyDown(screen.getByLabelText("其他"), { key: "ArrowRight" });
    expect(onWindowKey).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByLabelText("其他"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "报错" }));
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    window.removeEventListener("keydown", onWindowKey);
    expect(raw.prepare("SELECT COUNT(*) AS n FROM feedback").get()).toEqual({ n: 0 });
  });
});
