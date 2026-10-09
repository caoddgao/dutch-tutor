import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { fixtureContent, fsPackBackend, testServices } from "../test/services";

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
});

async function open(hash: string, over: Parameters<typeof testServices>[0] = {}) {
  window.location.hash = hash;
  const t = testServices({ content: fixtureContent(), ...over });
  await act(async () => {
    render(<App services={t.services} />);
  });
  return t;
}

describe("lesson page", () => {
  it("runs the six steps of a main lesson and resumes where the learner left off", async () => {
    const { raw, services } = await open("#/lesson/NN21");
    await screen.findByText("先完整听一两遍");
    const steps = within(screen.getByRole("navigation", { name: "上课步骤" }));
    expect(steps.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "1听原版",
      "2逐句学",
      "3词卡",
      "4小贴士",
      "5完成",
    ]);
    // text is hidden until asked for
    expect(screen.queryByText("Goedemorgen!")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "显示原文" }));
    expect(screen.getByText("Goedemorgen!")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /下一步：逐句学/ }));
    await screen.findByText("第 1 / 12 句");
    expect(screen.getByText("早上好！")).toBeTruthy();

    // next sentence, then click a word to open its entry
    fireEvent.click(screen.getByRole("button", { name: "下一个" }));
    await screen.findByText("第 2 / 12 句");
    fireEvent.click(screen.getByRole("button", { name: "wilt" }));
    const panel = within(screen.getByRole("region", { name: "词条" }));
    expect(panel.getByText("willen", { selector: ".word-entry-lemma" })).toBeTruthy();
    expect(panel.getByText("ww. 动词")).toBeTruthy();
    expect(panel.getByText("wilt")).toBeTruthy();

    // the position is saved
    await waitFor(() =>
      expect(raw.prepare("SELECT current_step, current_index FROM lesson_progress").get()).toEqual({
        current_step: 1,
        current_index: 1,
      }),
    );

    // reopening resumes at sentence 2
    document.body.innerHTML = "";
    window.location.hash = "#/lesson/NN21";
    await act(async () => {
      render(<App services={services} />);
    });
    await screen.findByText("第 2 / 12 句");
  });

  it("finishing puts sentences and new words into the review queue", async () => {
    const { raw } = await open("#/lesson/NN21");
    await screen.findByText("先完整听一两遍");
    fireEvent.click(screen.getByRole("button", { name: /完成/ }));
    await screen.findByText("第 21 课 学完了！");
    await waitFor(() => expect(screen.getByText(/已进入复习/)).toBeTruthy());
    const items = raw.prepare("SELECT item_id, item_type FROM review_items").all() as {
      item_id: string;
      item_type: string;
    }[];
    const ids = items.map((i) => i.item_id);
    expect(ids).toContain("NN21-S03");
    expect(ids).toContain("NN21-A01");
    expect(ids).toContain("w_brood");
    // single-word extras are reviewed as words, names are not reviewed, older words are not new here
    expect(ids).not.toContain("NN21-S10");
    expect(ids).not.toContain("w_de");
    expect(raw.prepare("SELECT status FROM lesson_progress WHERE lesson_id = 'NN21'").get()).toEqual({
      status: "studied",
    });
  });

  it("tips step shows the tip with its table and examples", async () => {
    await open("#/lesson/NN21");
    await screen.findByText("先完整听一两遍");
    fireEvent.click(screen.getByRole("button", { name: /小贴士/ }));
    expect(await screen.findByRole("heading", { name: "人称代词" })).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
  });

  it("phonics lessons start with the sounds", async () => {
    await open("#/lesson/P01");
    expect(await screen.findByText("短 a，短促。")).toBeTruthy();
    const steps = within(screen.getByRole("navigation", { name: "上课步骤" }));
    expect(steps.getAllByRole("button").map((b) => b.textContent)).toEqual(["1音", "2关键词", "3短句", "4完成"]);
  });

  it("main lessons need the pack", async () => {
    await open("#/lesson/NN21", { pack: fsPackBackend(null) });
    expect(await screen.findByText("需要资料包")).toBeTruthy();
    expect(screen.getByRole("link", { name: "去导入资料包" })).toBeTruthy();
  });
});
