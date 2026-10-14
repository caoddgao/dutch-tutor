import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioCtx } from "../audio/context";
import type { RecordingStore } from "../audio/recordings";
import { RecordButton } from "../exercises/RecordButton";
import { AzureContext, type Assessment } from "./context";

afterEach(() => vi.unstubAllGlobals());

describe("optional pronunciation scoring", () => {
  it("scores a saved oral take against the selected reference and shows weak words", async () => {
    const assess = vi.fn(async (): Promise<Assessment> => ({
      accuracy: 65,
      fluency: 76,
      completeness: 88,
      total: 73,
      low_words: [{ word: "morgen", accuracy: 42 }],
      month_seconds: 12,
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Blob(["voice"]))),
    );
    const recordings = {
      takes: async () => [{ id: 1, audioId: "q", url: "blob:take", duration: 1, createdAt: "now" }],
    } as unknown as RecordingStore;
    render(
      <AzureContext.Provider
        value={{
          status: { region: "westeurope", has_key: true, enabled: true, month: "2026-10", month_seconds: 0 },
          save: vi.fn(),
          clearKey: vi.fn(),
          testConnection: vi.fn(),
          assess,
        }}
      >
        <AudioCtx.Provider
          value={{ resolve: () => null, rate: 1, setRate: vi.fn(), recordings, refreshVoice: vi.fn() }}
        >
          <RecordButton id="q" references={["Hallo.", "Goedemorgen."]} canScore />
        </AudioCtx.Provider>
      </AzureContext.Provider>,
    );
    await screen.findByRole("button", { name: "发音评分" });
    fireEvent.change(screen.getByLabelText("评分参考答案"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "发音评分" }));
    await waitFor(() => expect(assess).toHaveBeenCalledWith(expect.any(Blob), "Goedemorgen."));
    expect(await screen.findByText("morgen")).not.toBeNull();
    expect(screen.getByText("总分")).not.toBeNull();
  });
});
