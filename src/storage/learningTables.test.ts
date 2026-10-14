import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTENT } from "../content/bundle";
import { buildCourseView } from "../content/model";
import type { PackIndex } from "../content/packTypes";
import { recordAnswer, lessonItems } from "../review/store";
import { FIXTURE_PACK_DIR, testServices } from "../test/services";
import { readWorkbook } from "../test/workbook";
import { saveExamResult } from "./examResults";
import { completeLesson, markStudyDay } from "./learning";
import { buildLearningTables, learningTableFileName } from "./learningTables";
import { buildWorkbook } from "./workbook";

const packIndex = JSON.parse(readFileSync(join(FIXTURE_PACK_DIR, "index.json"), "utf8")) as PackIndex;
const course = buildCourseView(CONTENT, packIndex);
const totalLessons = CONTENT.course.sections.reduce((n, s) => n + s.lessons.length, 0);

describe("buildLearningTables", () => {
  it("writes the four sheets with Chinese headers, lesson codes and local times", async () => {
    const { db } = testServices();
    const day1 = new Date(2026, 9, 12, 9, 5);
    const day2 = new Date(2026, 9, 13, 20, 30);
    await completeLesson(
      db,
      "P01",
      [
        { id: "P01-S01", type: "sentence" },
        { id: "w_kat", type: "word" },
      ],
      day1,
    );
    await completeLesson(db, "NN21", [{ id: "NN21-S02", type: "sentence" }], day2);
    await markStudyDay(db, day1, { sentences: 2 });
    const [item] = (await lessonItems(db, "P01")).filter((i) => i.item_type === "sentence");
    await recordAnswer(db, item, "good", "R1", "daily", { now: day2 });
    await recordAnswer(db, item, "bad", "R2", "daily", { now: day2 });
    await saveExamResult(db, "A1-MOCK-1-reading", 9, 12);
    await saveExamResult(db, "TT1", 18, 20);

    const now = new Date(2026, 9, 14, 8, 0);
    const sheets = await readWorkbook(await buildWorkbook(await buildLearningTables(db, course, CONTENT, now)));
    expect(sheets.map((s) => s.sheet)).toEqual(["课程进度", "测验成绩", "学习天数", "复习统计"]);
    const [progress, exams, days, reviews] = sheets.map((s) => s.data);

    // every lesson of the course, in course order, with its status
    expect(progress[0]).toEqual(["课号", "课题", "部分", "状态", "学完次数", "第一次学完", "最近学习"]);
    expect(progress).toHaveLength(1 + totalLessons);
    expect(progress[1]).toEqual([
      "P01",
      "短元音 a、e、i",
      "发音入门",
      "学过",
      1,
      "2026-10-12 09:05",
      "2026-10-12 09:05",
    ]);
    const nn21 = progress.find((r) => r[0] === "第 21 课");
    expect(nn21).toEqual(["第 21 课", "在面包店", "正课", "学过", 1, "2026-10-13 20:30", "2026-10-13 20:30"]);
    expect(progress.find((r) => r[0] === "测验 1")?.[3]).toBe("未学");

    expect(exams[0]).toEqual(["测验", "名称", "答对", "题数", "正确率（%）", "完成时间"]);
    expect(exams.slice(1).map((r) => r.slice(0, 5))).toEqual([
      ["测验 1", packIndex.lessons.find((l) => l.id === "TT1")?.title.zh ?? null, 18, 20, 90],
      ["A1 结业模拟考", "阅读", 9, 12, 75],
    ]);

    expect(days).toEqual([
      ["日期", "新学句子", "复习次数"],
      ["2026-10-12", 2, 0],
      ["2026-10-13", 0, 2],
    ]);

    expect(reviews[0]).toEqual([
      "课号",
      "课题",
      "句子",
      "词",
      "已熟练",
      "今天该复习",
      "复习次数",
      "会",
      "模糊",
      "不会",
      "最近复习",
    ]);
    expect(reviews.slice(1)).toEqual([
      // the sentence went back to one day after "不会": due on the 14th, like the two untouched items
      ["P01", "短元音 a、e、i", 1, 1, 0, 2, 2, 1, 0, 1, "2026-10-13 20:30"],
      ["第 21 课", "在面包店", 1, 0, 0, 1, 0, 0, 0, 0, null],
      ["合计", null, 2, 1, 0, 3, 2, 1, 0, 1, "2026-10-13 20:30"],
    ]);
  });

  it("writes only header rows when there is nothing yet", async () => {
    const { db } = testServices();
    const sheets = await readWorkbook(await buildWorkbook(await buildLearningTables(db, course, CONTENT)));
    expect(sheets.map((s) => s.data.length)).toEqual([1 + totalLessons, 1, 1, 1]);
    expect(sheets[0].data.slice(1).every((r) => r[3] === "未学")).toBe(true);
  });

  it("names the file by local date", () => {
    expect(learningTableFileName(new Date(2026, 9, 4))).toBe("Dutch-Tutor-学习数据表-2026-10-04.xlsx");
  });
});
