import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startRecording, type ActiveRecording } from "./recorder";
import { useShadowRecorder } from "./useShadowRecorder";

vi.mock("./recorder", async (original) => ({
  ...(await original<typeof import("./recorder")>()),
  startRecording: vi.fn(),
}));
afterEach(() => vi.restoreAllMocks());

describe("leaving during microphone permission", () => {
  it.each(["unmount", "next item"])("cancels a late permission result after %s", async (action) => {
    let allow!: (recorder: ActiveRecording) => void;
    vi.mocked(startRecording).mockReturnValue(
      new Promise((resolve) => {
        allow = resolve;
      }),
    );
    const save = vi.fn();
    const cancel = vi.fn();
    const hook = renderHook(({ id }) => useShadowRecorder(id, 15, save), { initialProps: { id: "first" } });
    let pending!: Promise<void>;
    act(() => {
      pending = hook.result.current.start();
    });
    if (action === "unmount") hook.unmount();
    else hook.rerender({ id: "next" });
    await act(async () => {
      allow({ cancel, stop: vi.fn() });
      await pending;
    });
    expect(cancel).toHaveBeenCalledOnce();
    expect(save).not.toHaveBeenCalled();
  });
});
