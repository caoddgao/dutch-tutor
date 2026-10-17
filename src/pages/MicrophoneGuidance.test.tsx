import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "../App";
import { RecorderError } from "../audio/recorder";
import { completeLesson } from "../storage/learning";
import { testServices } from "../test/services";

vi.mock("../audio/recorder", async (original) => ({
  ...(await original<typeof import("../audio/recorder")>()),
  startRecording: vi.fn(async () => {
    throw new RecorderError("denied");
  }),
}));
afterEach(() => vi.restoreAllMocks());

it.each(["practice", "lesson/NN21", "exam"])("%s shows Android permission guidance", async (path) => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Linux; Android 16");
  const { services, db } = testServices();
  await completeLesson(db, "NN21", [], new Date("2026-10-13T09:00:00Z"));
  window.location.hash = `#/${path}`;
  await act(async () => render(<App services={services} />));
  if (path.startsWith("lesson")) {
    fireEvent.click(
      within(await screen.findByRole("navigation", { name: "上课步骤" })).getByRole("button", { name: /逐句学/ }),
    );
  }
  if (path === "exam") fireEvent.click(await screen.findByRole("button", { name: "开始口语" }));
  const label = path === "practice" ? "录音" : path === "exam" ? "开口回答" : "跟读录音";
  fireEvent.click(await screen.findByRole("button", { name: label }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("权限管理 → 麦克风");
  expect(alert.textContent).not.toContain("Windows");
});
