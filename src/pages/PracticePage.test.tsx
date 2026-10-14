import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../App";
import { testServices } from "../test/services";

async function renderAt(hash: string) {
  window.location.hash = hash;
  await act(async () => {
    render(<App services={testServices().services} />);
  });
}

const rows = () => within(screen.getByRole("list", { name: "句子" })).getAllByRole("button");
const lessonSelect = () => screen.getByRole("combobox", { name: "课程" });

describe("PracticePage (static)", () => {
  beforeEach(() => window.localStorage.clear());

  it("starts on the latest lesson, groups all lessons under headings", async () => {
    await renderAt("#/practice");
    const card = await screen.findByRole("region", { name: "练习卡" });
    expect((lessonSelect() as HTMLSelectElement).value).toBe("NN22a");
    expect(rows()).toHaveLength(4);
    expect(within(card).getByText("Dit is mijn buurman Karel.")).toBeTruthy();
    expect(within(card).getByText("第 22 课 a · 我的邻居")).toBeTruthy();

    fireEvent.change(lessonSelect(), { target: { value: "all" } });
    expect(rows()).toHaveLength(20);
    const headings = within(screen.getByRole("list", { name: "句子" })).getAllByRole("heading");
    expect(headings.map((h) => h.textContent)).toEqual([
      "P01 · 短元音 a、e、i",
      "P02 · 长元音 aa、ee",
      "P03 · 短元音 o、u",
      "第 21 课 · 在面包店",
      "第 22 课 a · 我的邻居",
    ]);
  });

  it("lists studied sentences, filters by lesson and opens a sentence in the practice card", async () => {
    await renderAt("#/practice");
    await screen.findByRole("region", { name: "练习卡" });
    fireEvent.change(lessonSelect(), { target: { value: "NN21" } });
    fireEvent.click(screen.getByRole("button", { name: /Een bruin brood, alstublieft\./ }));
    const card = screen.getByRole("region", { name: "练习卡" });
    expect(within(card).getByText("Een bruin brood, alstublieft.")).toBeTruthy();
    expect(within(card).getByText("刚才这次的评分")).toBeTruthy();
    expect(within(card).getByText("alstublieft")).toBeTruthy();
    expect(within(card).getByText("最近 3 次录音")).toBeTruthy();

    fireEvent.change(lessonSelect(), { target: { value: "P02" } });
    expect(rows()).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: /Twee thee, graag\./ }));
    expect(within(screen.getByRole("region", { name: "练习卡" })).getByText("请来两杯茶。")).toBeTruthy();
    expect(screen.getByText("第 3 / 4 句")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /随机来一句/ }));
    expect(screen.queryByText("第 3 / 4 句")).toBeNull();
  });

  it("shows only hard sentences, and the empty state once none are left", async () => {
    await renderAt("#/practice");
    await screen.findByRole("region", { name: "练习卡" });
    fireEvent.change(lessonSelect(), { target: { value: "all" } });
    fireEvent.click(screen.getByRole("switch", { name: "只看我的难句" }));
    expect(rows()).toHaveLength(4);
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole("button", { name: "已收进难句" }));
    expect(screen.getByRole("heading", { name: "还没有难句" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "看全部句子" }));
    expect(rows()).toHaveLength(20);
  });

  it("without scoring, takes have no scores and point to the settings", async () => {
    await renderAt("#/practice?score=off");
    const card = await screen.findByRole("region", { name: "练习卡" });
    expect(within(card).queryByText("刚才这次的评分")).toBeNull();
    expect(within(card).getByRole("link", { name: "去设置" }).getAttribute("href")).toBe("#/settings");
  });

  it("before any lesson is studied it sends the learner to the courses", async () => {
    await renderAt("#/practice?sample=none");
    expect(await screen.findByRole("heading", { name: "还没有学过的课" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "去上第一课" }).getAttribute("href")).toBe("#/courses");
  });
});
