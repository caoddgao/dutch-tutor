import { describe, expect, it } from "vitest";
import { azureErrorMessage } from "./context";
import { encodePcmWav } from "./wav";

describe("pronunciation audio", () => {
  it("encodes 16 kHz mono PCM with correct size and clipped samples", () => {
    const bytes = encodePcmWav(new Float32Array([-2, 0, 2]));
    const view = new DataView(bytes.buffer);
    expect(new TextDecoder().decode(bytes.subarray(0, 4))).toBe("RIFF");
    expect(new TextDecoder().decode(bytes.subarray(8, 12))).toBe("WAVE");
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(6);
    expect(view.getInt16(44, true)).toBe(-32768);
    expect(view.getInt16(48, true)).toBe(32767);
  });

  it("gives a wait time for the F0 request limit", () => {
    expect(azureErrorMessage({ code: "rate_limited", retry_after: 14 })).toContain("14 秒");
  });
});
