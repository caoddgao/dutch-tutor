import { describe, expect, it } from "vitest";
import { readWorkbook } from "../test/workbook";
import { buildWorkbook } from "./workbook";

describe("buildWorkbook", () => {
  it("writes one sheet per table that reads back with Chinese intact", async () => {
    const bytes = await buildWorkbook([
      {
        name: "课程进度",
        columns: [{ title: "课号" }, { title: "课题" }, { title: "学完次数" }],
        rows: [
          ["第 21 课", "问候 & <你好>", 2],
          ["P01", null, 0],
        ],
      },
      { name: "学习天数", columns: [{ title: "日期" }], rows: [] },
    ]);
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const sheets = await readWorkbook(bytes);
    expect(sheets.map((s) => s.sheet)).toEqual(["课程进度", "学习天数"]);
    expect(sheets[0].data).toEqual([
      ["课号", "课题", "学完次数"],
      ["第 21 课", "问候 & <你好>", 2],
      ["P01", null, 0],
    ]);
    expect(sheets[1].data).toEqual([["日期"]]);
  });
});
