import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import type { PackInfo } from "../pack/backend";
import { fsPackBackend, FIXTURE_PACK_DIR, testServices } from "../test/services";

async function renderWith(pack: ReturnType<typeof fsPackBackend>, hash = "#/settings") {
  window.location.hash = hash;
  const { services } = testServices({ pack });
  await act(async () => {
    render(<App services={services} />);
  });
}

describe("资料包 settings", () => {
  beforeEach(() => window.localStorage.clear());

  it("a pack with another format version: asks to re-import", async () => {
    const real = fsPackBackend();
    await renderWith(
      fsPackBackend(undefined, {
        info: async () => {
          const i = await real.info();
          return { ...i, manifest: { ...i.manifest!, format_version: 2 } };
        },
      }),
    );
    expect(await screen.findByText("资料包需要重新导入")).toBeTruthy();
    expect(screen.getByText(/格式版本 2，这个版本的程序只认版本 1/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "重新导入" })).toBeTruthy();
  });

  it("without a pack: explains and imports the picked folder", async () => {
    let installed = false;
    const importFrom = vi.fn(async () => {
      installed = true;
      return {} as PackInfo;
    });
    const real = fsPackBackend();
    const pack = fsPackBackend(null, {
      info: async () => (installed ? real.info() : { dir: "", manifest: null, source_dir: null, imported_at: null }),
      readText: real.readText,
      pickFolder: async () => "F:\\NN_Pack\\nn-pack",
      importFrom,
    });
    await renderWith(pack);
    expect(screen.getByText("还没有导入")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "导入资料包" }));
    });
    expect(importFrom).toHaveBeenCalledWith("F:\\NN_Pack\\nn-pack");
    await waitFor(() => expect(screen.getByText("已导入 · 7 课")).toBeTruthy());
    expect(screen.getByText("导入完成。")).toBeTruthy();
  });

  it("shows a Chinese message when the format version is not supported", async () => {
    const pack = fsPackBackend(FIXTURE_PACK_DIR, {
      pickFolder: async () => "X:\\other",
      importFrom: async () => {
        throw { code: "format_version", detail: "2" };
      },
    });
    await renderWith(pack);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "重新导入" }));
    });
    expect(screen.getByRole("alert").textContent).toContain("格式版本是 2");
  });

  it("notices a newer pack in the original folder (created_at changed)", async () => {
    const real = fsPackBackend();
    const importFrom = vi.fn(async () => ({}) as PackInfo);
    const pack = fsPackBackend(FIXTURE_PACK_DIR, {
      info: async () => ({ ...(await real.info()), source_dir: "F:\\NN_Pack\\nn-pack" }),
      inspect: async () => ({ ...(await real.inspect("")), created_at: "2026-11-01T10:00:00+01:00" }),
      importFrom,
    });
    await renderWith(pack, "#/");
    await waitFor(() => expect(screen.getByText("资料包有新版本，重新导入后才能看到新内容。")).toBeTruthy());
    await act(async () => {
      fireEvent.click(screen.getByRole("link", { name: "去重新导入" }));
    });
    await waitFor(() => expect(screen.getByText(/资料包有新版本（生成于 2026-11-01/)).toBeTruthy());
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "重新导入" }).at(-1)!);
    });
    expect(importFrom).toHaveBeenCalledWith("F:\\NN_Pack\\nn-pack");
  });
});
