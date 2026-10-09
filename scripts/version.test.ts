import { describe, expect, it } from "vitest";
import { nextVersion } from "./version.mjs";

describe("nextVersion", () => {
  it("starts at 0.1.0 when there are no tags", () => {
    expect(nextVersion([])).toBe("0.1.0");
  });

  it("increments the highest patch number numerically", () => {
    expect(nextVersion(["v0.1.0", "v0.1.9", "v0.1.10", "v0.1.2"])).toBe("0.1.11");
  });

  it("ignores tags from other series and malformed tags", () => {
    expect(nextVersion(["v0.2.5", "v0.1.3-beta", "v1.0.0", "v0.1.4"])).toBe("0.1.5");
  });
});
