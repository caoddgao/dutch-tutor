import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServicesContext } from "../servicesContext";
import { collectBackup, serializeBackup } from "../storage/backup";
import { savePosition } from "../storage/learning";
import { memoryDataFiles, testServices } from "../test/services";
import { readWorkbook } from "../test/workbook";
import { BackupSection } from "./BackupSection";

async function setup() {
  const files = memoryDataFiles();
  const mem = testServices({ dataFiles: files });
  const onRestored = vi.fn();
  await act(async () => {
    render(
      <ServicesContext.Provider value={mem.services}>
        <BackupSection onRestored={onRestored} />
      </ServicesContext.Provider>,
    );
  });
  return { ...mem, files, onRestored };
}

const click = async (name: string) =>
  act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });

describe("BackupSection", () => {
  beforeEach(() => sessionStorage.clear());

  it("exports one backup file", async () => {
    const { files, db } = await setup();
    await savePosition(db, "NN21", 2, 3);
    await click("导出学习数据");
    expect(files.saved).toHaveLength(1);
    expect(files.saved[0].name).toMatch(/^Dutch-Tutor-学习数据-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(files.saved[0].text).tables.lesson_progress[0].lesson_id).toBe("NN21");
    expect(screen.getByRole("status").textContent).toMatch(/已导出/);
  });

  it("exports an Excel workbook to look at, and says it cannot be restored from", async () => {
    const { files, db } = await setup();
    await savePosition(db, "NN21", 2, 3);
    expect(screen.getByText(/表格只供查看，不能用来恢复/)).toBeTruthy();
    await click("导出成表格（只供查看）");
    // the Excel writer loads on first use
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/不能用来恢复/));
    expect(files.saved).toHaveLength(0);
    expect(files.workbooks).toHaveLength(1);
    expect(files.workbooks[0].name).toMatch(/^Dutch-Tutor-学习数据表-\d{4}-\d{2}-\d{2}\.xlsx$/);
    const sheets = await readWorkbook(files.workbooks[0].bytes);
    expect(sheets.map((s) => s.sheet)).toEqual(["课程进度", "测验成绩", "学习天数", "复习统计"]);
    // without the content context the codes still follow the course map; the lesson is opened, not finished
    expect(sheets[0].data.find((r) => r[0] === "第 21 课")?.[3]).toBe("未学");
  });

  it("refuses a bad file in plain words and changes nothing", async () => {
    const { files, raw, onRestored } = await setup();
    files.nextImport = '{"format":"something-else"}';
    await click("从备份恢复");
    expect(screen.getByRole("alert").textContent).toMatch(/不是 Dutch Tutor 的学习数据备份/);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(files.safety).toHaveLength(0);
    expect(onRestored).not.toHaveBeenCalled();
    expect(raw.prepare("SELECT COUNT(*) AS n FROM lesson_progress").get()).toEqual({ n: 0 });
  });

  it("asks first, keeps a safety copy, then overwrites", async () => {
    // a backup made on another install
    const other = testServices();
    await savePosition(other.db, "NN40", 1, 0);
    const text = serializeBackup(await collectBackup(other.db, other.services.settings));
    const { files, db, raw, onRestored, settingsData } = await setup();
    await savePosition(db, "P01", 2, 0);
    files.nextImport = text;
    await click("从备份恢复");
    const dialog = screen.getByRole("alertdialog");
    expect(dialog.textContent).toMatch(/覆盖当前的学习/);
    expect(dialog.textContent).toMatch(/学过 0 课/);

    // cancelling leaves everything as it was
    await click("取消");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(files.safety).toHaveLength(0);

    await click("从备份恢复");
    await click("覆盖并恢复");
    expect(files.safety).toHaveLength(1);
    expect(JSON.parse(files.safety[0]).tables.lesson_progress[0].lesson_id).toBe("P01");
    expect(raw.prepare("SELECT lesson_id FROM lesson_progress").all()).toEqual([{ lesson_id: "NN40" }]);
    expect(settingsData.theme).toBe("system");
    expect(onRestored).toHaveBeenCalledTimes(1);
  });

  it("does not restore when the safety copy cannot be written", async () => {
    const { files, db, raw, onRestored } = await setup();
    await savePosition(db, "P01", 2, 0);
    files.saveSafetyCopy = async () => {
      throw new Error("disk full");
    };
    const other = testServices();
    files.nextImport = serializeBackup(await collectBackup(other.db, other.services.settings));
    await click("从备份恢复");
    await click("覆盖并恢复");
    expect(screen.getByRole("alert").textContent).toMatch(/没有恢复/);
    expect(raw.prepare("SELECT lesson_id FROM lesson_progress").all()).toEqual([{ lesson_id: "P01" }]);
    expect(onRestored).not.toHaveBeenCalled();
  });
});
