// SECURITY NOTE:
// We use SheetJS (xlsx) ONLY for generating exports from trusted DB data.
// Do NOT add Excel import/upload parsing with this library due to known advisories.
// If import is needed later, switch libraries or isolate parsing.

import * as XLSX from "xlsx";

type ExcelCellValue = string | number | Date | boolean | null | undefined;

export type ExcelColumn = {
  key: string;
  header: string;
  type?: "text" | "number" | "currency" | "date" | "id" | "notes";
  width?: number;
};

export type ExcelSheet = {
  name: string;
  columns: ExcelColumn[];
  rows: Record<string, ExcelCellValue>[];
};

const CURRENCY_FORMAT = "$#,##0.00;[Red]-$#,##0.00";
const DATE_FORMAT = "mm/dd/yyyy";

const TYPE_WIDTHS: Record<NonNullable<ExcelColumn["type"]>, number> = {
  id: 18,
  text: 20,
  number: 12,
  currency: 14,
  date: 12,
  notes: 50,
};

export function formatDateMMDDYYYY(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${month}/${day}/${year}`;
}

export function safeFilenameDateUTC(): string {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const year = now.getUTCFullYear();
  return `${year}-${month}-${day}`;
}

function normalizeCellValue(value: ExcelCellValue, type?: ExcelColumn["type"]): ExcelCellValue {
  if (value === null || value === undefined) return "";
  if (type === "date") {
    if (value instanceof Date) return value;
    const parsed = typeof value === "string" ? new Date(value) : null;
    return parsed && !Number.isNaN(parsed.valueOf()) ? parsed : "";
  }
  return value;
}

function estimateWidth(values: ExcelCellValue[], header: string, type?: ExcelColumn["type"]): number {
  if (type && TYPE_WIDTHS[type]) return TYPE_WIDTHS[type];
  const base = Math.max(
    header.length,
    ...values.map((value) => {
      if (value === null || value === undefined) return 0;
      if (value instanceof Date) return formatDateMMDDYYYY(value).length;
      return String(value).length;
    }),
  );
  return Math.min(60, Math.max(12, base + 2));
}

function cellAlignment(type?: ExcelColumn["type"]) {
  const numeric = type === "number" || type === "currency" || type === "id";
  return {
    horizontal: numeric ? "right" : "left",
    vertical: "top",
    wrapText: type === "notes",
  } as XLSX.Alignment;
}

function applyHeaderStyle(cell?: XLSX.CellObject) {
  if (!cell) return;
  cell.s = {
    font: { bold: true },
    alignment: { vertical: "top", wrapText: true },
  };
}

function applyCellStyle(cell?: XLSX.CellObject, type?: ExcelColumn["type"]) {
  if (!cell) return;
  cell.s = {
    alignment: cellAlignment(type),
  };
  if (type === "currency") {
    cell.z = CURRENCY_FORMAT;
  }
  if (type === "date") {
    cell.z = DATE_FORMAT;
  }
}

export function buildWorkbookBuffer(sheets: ExcelSheet[]): Buffer {
  const workbook = XLSX.utils.book_new();

  sheets.forEach((sheet) => {
    const headerRow = sheet.columns.map((column) => column.header);
    const dataRows = sheet.rows.map((row) =>
      sheet.columns.map((column) => normalizeCellValue(row[column.key], column.type)),
    );
    const worksheet = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows], { cellDates: true });
    const headerRange = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: 0, c: Math.max(0, sheet.columns.length - 1) },
    });

    worksheet["!autofilter"] = { ref: headerRange };
    worksheet["!freeze"] = {
      xSplit: 0,
      ySplit: 1,
      topLeftCell: "A2",
      activePane: "bottomLeft",
      state: "frozen",
    };

    worksheet["!cols"] = sheet.columns.map((column, index) => {
      const values = sheet.rows.map((row) => row[column.key]);
      return { wch: column.width ?? estimateWidth(values, column.header, column.type) };
    });

    sheet.columns.forEach((column, index) => {
      const headerCell = XLSX.utils.encode_cell({ r: 0, c: index });
      applyHeaderStyle(worksheet[headerCell]);
      for (let rowIndex = 0; rowIndex < sheet.rows.length; rowIndex += 1) {
        const cellRef = XLSX.utils.encode_cell({ r: rowIndex + 1, c: index });
        applyCellStyle(worksheet[cellRef], column.type);
      }
    });

    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  });

  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer", cellStyles: true });
}
