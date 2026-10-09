import { describe, expect, it } from "vitest";
import { DEMO_CONTINUE, DEMO_SECTIONS } from "./demoCourse";
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

describe("demo course", () => {
  it("has unique ids and progress within 0–1", () => {
    const all = DEMO_SECTIONS.flatMap((s) => s.lessons);
    expect(new Set(all.map((l) => l.id)).size).toBe(all.length);
    for (const l of all) expect(l.progress).toBeGreaterThanOrEqual(0);
    for (const l of all) expect(l.progress).toBeLessThanOrEqual(1);
  });

  it("continues the recommended lesson", () => {
    expect(recommendNext(DEMO_SECTIONS)?.id).toBe(DEMO_CONTINUE.lessonId);
  });

  it("counts statuses", () => {
    expect(countByStatus(DEMO_SECTIONS[0].lessons)).toEqual({ new: 0, studied: 6, mastered: 4 });
  });
});
