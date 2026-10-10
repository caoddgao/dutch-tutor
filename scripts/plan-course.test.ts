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

  it("keeps a reviewer's `from` when the same part is planned again", () => {
    const edited = structuredClone(course);
    const b = edited.sections.find((s) => s.id === "main")!.lessons.find((r) => r.id === "NN21b")!;
    b.part!.from = "NN21-S20";
    expect(planMainSection(index, edited).find((r) => r.id === "NN21b")!.part).toEqual({
      n: 2,
      of: 2,
      from: "NN21-S20",
    });
  });

  it("prints a table for review", () => {
    const table = planTable(index, course);
    expect(table).toContain("正课 45 课 → 87 节");
    expect(table).toContain(
      "| 22 | Vragen / 提问 | 49 | 51 | 3.7 秒 | 3 部分（17 + 16 + 16 句） | 句子 > 24，新词 > 45 |",
    );
  });
});
