// Excel tables to look at (decision 29): learning data and content reports as `.xlsx`.
// Built in the front end with write-excel-file (MIT, its only dependency is fflate); the library is loaded
// on first use so it stays out of start-up. Tables are for reading only; restore reads JSON backups.

export type CellValue = string | number | null;

export interface TableColumn {
  /** Column title in the header row (Chinese) */
  title: string;
  /** Approximate width in characters */
  width?: number;
}

export interface TableSheet {
  /** Sheet tab name (Chinese, ≤ 31 characters, none of : \ / ? * [ ]) */
  name: string;
  columns: TableColumn[];
  rows: CellValue[][];
}

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** A workbook with one sheet per table: bold, frozen header row, then the rows as text and numbers. */
export async function buildWorkbook(sheets: TableSheet[]): Promise<Uint8Array> {
  const { default: writeXlsxFile } = await import("write-excel-file/universal");
  const blob = await writeXlsxFile(
    sheets.map((s) => ({
      sheet: s.name,
      stickyRowsCount: 1,
      columns: s.columns.map((c) => ({ width: c.width ?? 14 })),
      data: [
        s.columns.map((c) => ({ value: c.title, fontWeight: "bold" as const })),
        ...s.rows.map((row) =>
          row.map((v) =>
            v === null || v === "" ? null : typeof v === "number" ? { value: v } : { value: v, wrap: true },
          ),
        ),
      ],
    })),
  ).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}
