import { afterEach, describe, expect, it, vi } from "vitest";
import { recorderErrorMessage, startRecording } from "./recorder";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("microphone failures", () => {
  it.each([
    ["NotAllowedError", "denied"],
    ["SecurityError", "denied"],
    ["NotFoundError", "no_device"],
    ["NotReadableError", "busy"],
    ["AbortError", "busy"],
    ["UnknownError", "unsupported"],
  ])("maps %s to a user-facing failure", async (name, code) => {
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(new DOMException("", name)) },
    });
    vi.stubGlobal("MediaRecorder", class {});
    await expect(startRecording()).rejects.toMatchObject({ code });
  });

  it.each(["denied", "no_device", "busy", "unsupported"] as const)(
    "explains Android %s in Chinese with system settings",
    (code) => {
      const message = recorderErrorMessage(code, "Linux; Android 16");
      expect(message).toContain("权限管理 → 麦克风");
      expect(message).toContain("麦克风访问");
      expect(message).not.toMatch(/Windows|NotAllowed|MediaRecorder|WebView|unsupported/);
    },
  );

  it("keeps the Windows permission guidance", () => {
    expect(recorderErrorMessage("denied", "Windows NT 10.0")).toContain("允许桌面应用访问麦克风");
  });

  it("releases the microphone when the browser cannot start its recorder", async () => {
    const stop = vi.fn();
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop }] }) } });
    vi.stubGlobal(
      "MediaRecorder",
      class {
        static isTypeSupported() {
          return true;
        }
        start() {
          throw new Error("unsupported recorder");
        }
      },
    );
    await expect(startRecording()).rejects.toMatchObject({ code: "unsupported" });
    expect(stop).toHaveBeenCalledOnce();
  });
});
