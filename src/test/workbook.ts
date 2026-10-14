import readXlsxFile from "read-excel-file/universal";

/** Reads an exported workbook back with an independent reader: sheet names and cell values. */
export function readWorkbook(bytes: Uint8Array) {
  return readXlsxFile(bytes.slice().buffer as ArrayBuffer);
}
