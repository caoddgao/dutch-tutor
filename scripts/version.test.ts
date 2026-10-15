import { describe, expect, it } from "vitest";
import { nextVersion } from "./version.mjs";

describe("nextVersion", () => {
  it("starts at 1.0.0 when there are no tags of the series", () => {
    expect(nextVersion([])).toBe("1.0.0");
    expect(nextVersion(["v0.1.35", "v0.1.36"])).toBe("1.0.0");
  });

  it("increments the highest patch number numerically", () => {
    expect(nextVersion(["v1.0.0", "v1.0.9", "v1.0.10", "v1.0.2"])).toBe("1.0.11");
    expect(nextVersion(["v0.1.0", "v0.1.9", "v0.1.10"], "0.1")).toBe("0.1.11");
  });

  it("ignores tags from other series and malformed tags", () => {
    expect(nextVersion(["v0.2.5", "v1.0.3-beta", "v0.1.9", "v1.0.4"])).toBe("1.0.5");
  });
});
