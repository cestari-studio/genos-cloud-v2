// genOS Full v1.0.0 "Lumina" — csvEngine.ts
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import crypto from 'crypto';

const PROJECTS_DIR = path.resolve(__dirname, '..', '..', 'projects');

export interface CsvRow {
  [key: string]: string;
}

/**
 * Get the full path to a CSV file for a given tenant slug and csv path
 */
export function getCsvPath(tenantSlug: string, csvLocalPath: string): string {
  return path.join(PROJECTS_DIR, tenantSlug, csvLocalPath);
}

/**
 * Read a CSV file and return parsed rows
 */
export function readCsv(filePath: string): CsvRow[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const result = Papa.parse<CsvRow>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });
  return result.data;
}

/**
 * Write rows to a CSV file (overwrites) — comma-delimited
 */
export function writeCsv(filePath: string, rows: CsvRow[]): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const csv = Papa.unparse(rows);
  fs.writeFileSync(filePath, csv, 'utf-8');
}

/**
 * Write rows to a CSV file with semicolon delimiter + UTF-8 BOM
 * Required for social media CSVs (Brazilian Excel compatibility)
 */
export function writeCsvSemicolon(filePath: string, rows: CsvRow[]): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const csv = Papa.unparse(rows, { delimiter: ';' });
  const BOM = '\uFEFF';
  fs.writeFileSync(filePath, BOM + csv, 'utf-8');
}

/**
 * Read a CSV file with semicolon delimiter
 */
export function readCsvSemicolon(filePath: string): CsvRow[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  let content = fs.readFileSync(filePath, 'utf-8');
  // Strip BOM if present
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  const result = Papa.parse<CsvRow>(content, {
    header: true,
    skipEmptyLines: true,
    delimiter: ';',
    transformHeader: (h: string) => h.trim(),
  });
  return result.data;
}

/**
 * Generate CSV content string with semicolon delimiter + UTF-8 BOM (for HTTP response)
 */
export function generateCsvStringSemicolon(rows: CsvRow[]): string {
  const csv = Papa.unparse(rows, { delimiter: ';' });
  const BOM = '\uFEFF';
  return BOM + csv;
}

/**
 * Append rows to an existing CSV file
 */
export function appendCsv(filePath: string, rows: CsvRow[]): void {
  const existing = readCsv(filePath);
  writeCsv(filePath, [...existing, ...rows]);
}

/**
 * Update rows in a CSV by matching on a key field
 */
export function updateCsv(
  filePath: string,
  updates: CsvRow[],
  keyField: string = 'id'
): { updated: number; notFound: string[] } {
  const existing = readCsv(filePath);
  const updateMap = new Map(updates.map(u => [u[keyField], u]));
  let updated = 0;
  const notFound: string[] = [];

  const result = existing.map(row => {
    const update = updateMap.get(row[keyField]);
    if (update) {
      updated++;
      updateMap.delete(row[keyField]);
      return { ...row, ...update };
    }
    return row;
  });

  for (const key of updateMap.keys()) {
    notFound.push(key);
  }

  writeCsv(filePath, result);
  return { updated, notFound };
}

/**
 * Delete rows from a CSV by matching on a key field
 */
export function deleteCsvRows(
  filePath: string,
  ids: string[],
  keyField: string = 'id'
): number {
  const existing = readCsv(filePath);
  const idSet = new Set(ids);
  const filtered = existing.filter(row => !idSet.has(row[keyField]));
  const deleted = existing.length - filtered.length;
  writeCsv(filePath, filtered);
  return deleted;
}

/**
 * Compute MD5 hash of a row (for drift detection)
 */
export function hashRow(row: CsvRow): string {
  const sorted = Object.keys(row).sort().map(k => `${k}=${row[k]}`).join('|');
  return crypto.createHash('md5').update(sorted).digest('hex');
}

/**
 * Compare two sets of rows and find diffs
 */
export function diffRows(
  source: CsvRow[],
  target: CsvRow[],
  keyField: string = 'id'
): {
  added: CsvRow[];
  updated: CsvRow[];
  deleted: CsvRow[];
} {
  const sourceMap = new Map(source.map(r => [r[keyField], r]));
  const targetMap = new Map(target.map(r => [r[keyField], r]));

  const added: CsvRow[] = [];
  const updated: CsvRow[] = [];
  const deleted: CsvRow[] = [];

  for (const [key, row] of sourceMap) {
    const targetRow = targetMap.get(key);
    if (!targetRow) {
      added.push(row);
    } else if (hashRow(row) !== hashRow(targetRow)) {
      updated.push(row);
    }
  }

  for (const [key, row] of targetMap) {
    if (!sourceMap.has(key)) {
      deleted.push(row);
    }
  }

  return { added, updated, deleted };
}
