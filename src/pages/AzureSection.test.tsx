import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AzureContext } from "../pronunciation/context";
import { AzureSection } from "./AzureSection";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true }));

describe("Azure settings", () => {
  it("sends a new key only on save and clears the input afterward", async () => {
    const save = vi.fn(async () => undefined);
    render(
      <AzureContext.Provider
        value={{
          status: { region: "westeurope", enabled: false, has_key: false, month: "2026-10", month_seconds: 0 },
          save,
          clearKey: vi.fn(),
          testConnection: vi.fn(),
          assess: vi.fn(),
        }}
      >
        <AzureSection />
      </AzureContext.Provider>,
    );
    fireEvent.change(screen.getByLabelText("Azure 密钥"), { target: { value: "example-secret" } });
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith("westeurope", "example-secret", false));
    await waitFor(() => expect((screen.getByLabelText("Azure 密钥") as HTMLInputElement).value).toBe(""));
  });
});
