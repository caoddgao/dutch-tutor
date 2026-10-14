import { describe, expect, it } from "vitest";
import { formatRecent } from "./format";

describe("formatRecent", () => {
  const now = new Date(2026, 9, 14, 21, 30, 0);
  it("says just now, today, yesterday or the date", () => {
    expect(formatRecent(new Date(2026, 9, 14, 21, 29, 30).toISOString(), now)).toBe("刚才");
    expect(formatRecent(new Date(2026, 9, 14, 9, 5).toISOString(), now)).toBe("今天 09:05");
    expect(formatRecent(new Date(2026, 9, 13, 20, 45).toISOString(), now)).toBe("昨天 20:45");
    expect(formatRecent(new Date(2026, 9, 2, 8, 0).toISOString(), now)).toBe("10月2日 08:00");
  });
});
