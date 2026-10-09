import { describe, expect, it } from "vitest";
import { countByStatus, displayStatus, recommendNext, type CourseSection } from "./types";

const mk = (id: string, status: "new" | "studied" | "mastered") => ({
  id,
  kind: "main" as const,
  code: id,
  title: { nl: id, zh: id, en: id },
  status,
  progress: 0,
});

describe("recommendNext", () => {
  it("picks the first new lesson in course order across sections", () => {
    const sections: CourseSection[] = [
      { id: "a", title: "a", lessons: [mk("P01", "mastered"), mk("P02", "studied")] },
      { id: "b", title: "b", lessons: [mk("L1", "studied"), mk("L2", "new"), mk("L3", "new")] },
    ];
    expect(recommendNext(sections)?.id).toBe("L2");
  });

  it("returns nothing when every lesson has been studied", () => {
    expect(recommendNext([{ id: "a", title: "a", lessons: [mk("P01", "studied")] }])).toBeUndefined();
  });
});

describe("displayStatus", () => {
  it("marks only the recommended lesson as recommended", () => {
    expect(displayStatus(mk("L2", "new"), "L2")).toBe("recommended");
    expect(displayStatus(mk("L3", "new"), "L2")).toBe("new");
    expect(displayStatus(mk("L1", "mastered"), "L2")).toBe("mastered");
  });
});

describe("countByStatus", () => {
  it("counts each status", () => {
    expect(countByStatus([mk("a", "new"), mk("b", "studied"), mk("c", "mastered"), mk("d", "studied")])).toEqual({
      new: 1,
      studied: 2,
      mastered: 1,
    });
  });
});
