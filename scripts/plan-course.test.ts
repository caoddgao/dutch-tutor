// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CourseDef } from "../src/content/ownTypes";
import type { PackIndex } from "../src/content/packTypes";
import { REPO_ROOT } from "./lib/contentFiles";
import { planMainSection, planTable } from "./plan-course";

const read = <T>(rel: string) => JSON.parse(readFileSync(join(REPO_ROOT, rel), "utf8")) as T;
const index = read<PackIndex>("content/a1/nn-index.json");
const course = read<CourseDef>("content/a1/course.json");

describe("split plan from nn-index.json", () => {
  it("course.json's main section is the plan (re-run scripts/plan-course.ts --write after changing it)", () => {
    expect(planMainSection(index, course)).toEqual(course.sections.find((s) => s.id === "main")!.lessons);
  });

  it("splits 7 lessons into 2 parts each, with the reviewer's split points (52 course lessons)", () => {
    const plan = planMainSection(index, course);
    expect(plan).toHaveLength(52);
    expect(plan.filter((r) => r.part?.n === 2).map((r) => r.part!.from)).toEqual([
      "NN22-S18",
      "NN24-S17",
      "NN25-S13",
      "NN33-S20",
      "NN42-S22",
      "NN50-S20",
      "NN53-S17",
    ]);
  });

  it("keeps a reviewer's `from` when the same part is planned again", () => {
    const edited = structuredClone(course);
    const b = edited.sections.find((s) => s.id === "main")!.lessons.find((r) => r.id === "NN22b")!;
    b.part!.from = "NN22-S20";
    expect(planMainSection(index, edited).find((r) => r.id === "NN22b")!.part).toEqual({
      n: 2,
      of: 2,
      from: "NN22-S20",
    });
  });

  it("counts text sentences (line_count); falls back to sentence_count without it", () => {
    const old = structuredClone(index);
    for (const l of old.lessons) delete l.line_count;
    // NN35: 48 sentences, 31 of them text
    expect(planMainSection(index, course).some((r) => r.id === "NN35")).toBe(true);
    expect(planMainSection(old, course).filter((r) => r.pack_id === "NN35")).toHaveLength(2);
  });

  it("prints a table for review", () => {
    const table = planTable(index, course);
    expect(table).toContain("正课 45 课 → 52 节");
    expect(table).toContain(
      "| 22 | Vragen / 提问 | 49 | 28 | 51 | 3.7 秒 | 2 部分（从 S18 起，17 + 11 句） | 新词 > 45 |",
    );
    expect(table).toContain("| 35 | Niets bijzonders / 没什么特别的 | 48 | 31 | 40 | 3.2 秒 | — |  |");
  });
});
