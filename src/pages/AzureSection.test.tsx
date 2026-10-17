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

it("saves a pasted key before testing, supports enabling, and shows monthly minutes", async () => {
  const calls: string[] = [];
  const save = vi.fn(async () => {
    calls.push("save");
  });
  const testConnection = vi.fn(async () => {
    calls.push("test");
  });
  render(
    <AzureContext.Provider
      value={{
        status: { region: "westeurope", enabled: false, has_key: false, month: "2026-10", month_seconds: 90 },
        save,
        testConnection,
        clearKey: vi.fn(),
        assess: vi.fn(),
      }}
    >
      <AzureSection />
    </AzureContext.Provider>,
  );
  const key = screen.getByLabelText("Azure 密钥") as HTMLInputElement;
  expect(key.disabled).toBe(false);
  expect(key.getAttribute("autocapitalize")).toBe("none");
  fireEvent.change(key, { target: { value: "pasted-example-key" } });
  fireEvent.click(screen.getByRole("button", { name: "测试连接" }));
  await screen.findByText("连接成功，可以开启发音评分。");
  expect(calls).toEqual(["save", "test"]);
  expect(save).toHaveBeenCalledWith("westeurope", "pasted-example-key", false);
  expect(key.value).toBe("");
  expect(screen.getByText(/1.5 \/ 300 分钟/)).toBeTruthy();
  fireEvent.change(key, { target: { value: "pasted-example-key" } });
  fireEvent.click(screen.getByRole("switch", { name: "开启发音评分" }));
  await waitFor(() => expect(save).toHaveBeenLastCalledWith("westeurope", "pasted-example-key", true));
});

it("explains an invalid key without clearing the saved key", async () => {
  const clearKey = vi.fn();
  render(
    <AzureContext.Provider
      value={{
        status: { region: "westeurope", enabled: false, has_key: true, month: "2026-10", month_seconds: 0 },
        save: vi.fn(),
        testConnection: vi.fn().mockRejectedValue({ code: "invalid_key" }),
        clearKey,
        assess: vi.fn(),
      }}
    >
      <AzureSection />
    </AzureContext.Provider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "测试连接" }));
  expect(await screen.findByText("密钥或区域不正确，请核对后重试。")).toBeTruthy();
  expect(clearKey).not.toHaveBeenCalled();
});
