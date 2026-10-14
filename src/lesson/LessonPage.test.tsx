import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { CONTENT } from "../content/bundle";
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
  it("scores a pack stage test and allows a fresh attempt", async () => {
    const { raw } = await open("#/lesson/TT1", { content: CONTENT });
    await screen.findByText("第 1 / 1 题");
    fireEvent.click(screen.getByRole("button", { name: "brood" }));
    fireEvent.click(screen.getByRole("button", { name: /完成练习/ }));
    expect(await screen.findByText("测验 1 完成了！")).toBeTruthy();
    await waitFor(() =>
      expect(raw.prepare("SELECT correct, total FROM exam_results WHERE id = 'TT1'").get()).toEqual({
        correct: 1,
        total: 1,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "再测一次" }));
    expect(await screen.findByText("第 1 / 1 题")).toBeTruthy();
  });
  it("runs the six steps of a main lesson and resumes where the learner left off", async () => {
    const { raw, services } = await open("#/lesson/NN21");
    await screen.findByText("先完整听一两遍");
    const steps = within(screen.getByRole("navigation", { name: "上课步骤" }));
    expect(steps.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "1听原版",
      "2逐句学",
      "3词卡",
      "4小贴士",
      "5练习",
      "6完成",
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

  it("exercises: book examples are shown answered, answers are checked and scored", async () => {
    await open("#/lesson/NN21");
    await screen.findByText("先完整听一两遍");
    fireEvent.click(screen.getByRole("button", { name: /练习/ }));
    expect(await screen.findByText(/^第 1 \/ \d+ 题$/)).toBeTruthy();
    // walk to the first book example (choose_one, item 1)
    for (let i = 0; i < 30 && !screen.queryByText("示范"); i++) {
      const options = screen
        .queryAllByRole("button")
        .filter((b) => b.classList.contains("q-option") && !b.hasAttribute("disabled"));
      if (options.length) fireEvent.click(options[0]);
      let block = document.querySelector<HTMLButtonElement>(".order-pool .order-block:not([disabled])");
      while (block) {
        fireEvent.click(block);
        block = document.querySelector<HTMLButtonElement>(".order-pool .order-block:not([disabled])");
      }
      for (const b of screen.queryAllByRole("button", { name: "选这个" })) {
        fireEvent.click(b);
        break;
      }
      const reveal = screen.queryByRole("button", { name: "看参考答案" });
      if (reveal) {
        fireEvent.click(reveal);
        fireEvent.click(screen.getByRole("button", { name: "会" }));
      }
      fireEvent.click(screen.getByRole("button", { name: /下一题|完成练习/ }));
    }
    expect(screen.getByText("这是课本里的示范题，看一看就好。")).toBeTruthy();
    // the example's answer is already marked and the next button is open
    expect(screen.getByLabelText("正确答案")).toBeTruthy();
    expect((screen.getByRole("button", { name: "下一题" }) as HTMLButtonElement).disabled).toBe(false);
    // the following real item is checked when answered
    fireEvent.click(screen.getByRole("button", { name: "下一题" }));
    fireEvent.click(screen.getByRole("button", { name: /wilt/ }));
    expect(screen.getByRole("status").textContent).toBe("答对了！");
  });

  it("phonics lessons start with the sounds", async () => {
    await open("#/lesson/P01");
    expect(await screen.findByText("短 a，短促。")).toBeTruthy();
    const steps = within(screen.getByRole("navigation", { name: "上课步骤" }));
    expect(steps.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "1音",
      "2关键词",
      "3短句",
      "4听辨练习",
      "5完成",
    ]);
  });

  it("phonics lessons end with the reading text: listen, then shadow it sentence by sentence", async () => {
    const { raw } = await open("#/lesson/P02");
    await screen.findByText("短 e，短促。");
    const steps = within(screen.getByRole("navigation", { name: "上课步骤" }));
    // P01 already uses NN05's exercises; the reading text's own exercises are not used
    expect(steps.getAllByRole("button").map((b) => b.textContent)).toEqual(["1音", "2关键词", "3认读小文", "4完成"]);
    fireEvent.click(steps.getByRole("button", { name: /认读小文/ }));
    expect(await screen.findByText("认读小文：先完整听一遍")).toBeTruthy();
    expect(screen.queryByText("Ik koop kaas.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "显示原文" }));
    expect(screen.getByText("Ik koop kaas.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /下一步：逐句跟读/ }));
    await screen.findByText("第 1 / 6 句");
    expect(screen.getByText("今天是星期六。")).toBeTruthy();
    expect(screen.getByRole("button", { name: "跟读录音" })).toBeTruthy();
    // words open their entries from the pack
    fireEvent.click(screen.getByRole("button", { name: "zaterdag" }));
    expect(within(screen.getByRole("region", { name: "词条" })).getByText("星期六")).toBeTruthy();
    // back to the listening screen, then forward through all six sentences
    fireEvent.click(screen.getByRole("button", { name: "上一个" }));
    await screen.findByText("认读小文：先完整听一遍");
    fireEvent.click(screen.getByRole("button", { name: /下一步：逐句跟读/ }));
    for (let i = 1; i <= 6; i++) {
      await screen.findByText(`第 ${i} / 6 句`);
      fireEvent.click(screen.getByRole("button", { name: "下一个" }));
    }
    await screen.findByText("P02 学完了！");
    await waitFor(() => expect(screen.getByText(/已进入复习/)).toBeTruthy());
    const ids = (raw.prepare("SELECT item_id FROM review_items").all() as { item_id: string }[]).map((i) => i.item_id);
    expect(ids).toContain("NN14-S05");
    expect(ids).toContain("w_kaas");
    expect(ids).not.toContain("NN14-S00");
  });

  it("main lessons need the pack", async () => {
    await open("#/lesson/NN21", { pack: fsPackBackend(null) });
    expect(await screen.findByText("需要资料包")).toBeTruthy();
    expect(screen.getByRole("link", { name: "去导入资料包" })).toBeTruthy();
  });

  it("a lesson the installed pack lacks says so", async () => {
    await open("#/lesson/NN33b", { content: CONTENT });
    expect(await screen.findByText("资料包里没有这一课")).toBeTruthy();
    expect(screen.getByText(/还没有这一课（第 33 课 b）/)).toBeTruthy();
  });

  it("a pack with another format version asks for re-importing", async () => {
    const real = fsPackBackend();
    const pack = fsPackBackend(undefined, {
      info: async () => {
        const i = await real.info();
        return { ...i, manifest: { ...i.manifest!, format_version: 2 } };
      },
    });
    await open("#/lesson/NN22a", { pack, content: CONTENT });
    expect(await screen.findByText("资料包需要重新导入")).toBeTruthy();
  });

  it("split lessons: each part teaches its stretch of the text (the repo course starts NN22b at S18)", async () => {
    await open("#/lesson/NN22a", { content: CONTENT });
    await screen.findByText("先完整听一两遍");
    expect(screen.getByText(/第 1 部分（共 2 部分）/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /下一步：逐句学/ }));
    // 17 text sentences of the fixture pack + our 3 added sentences (content/a1/lessons/NN22a.json)
    await screen.findByText("第 1 / 20 句");
    cleanup();
    await open("#/lesson/NN22b", { content: CONTENT });
    await screen.findByText("先完整听一两遍");
    expect(screen.getByText(/第 2 部分（共 2 部分）/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /下一步：逐句学/ }));
    await screen.findByText("第 1 / 6 句");
    expect(document.querySelector("main")!.textContent).toContain("buren");
  });
});
