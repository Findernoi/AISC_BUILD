// Use the bundled Node runtime and artifact-tool dependencies, not app dependencies.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Workbook } from '@oai/artifact-tool';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const staging = path.join(root, 'tmp/workforce_dataset');
const output = path.join(root, 'data/workforce_synthetic');
const tables = JSON.parse(await fs.readFile(path.join(staging, 'tables.json'), 'utf8'));
await fs.mkdir(output, { recursive: true });
function cell(value) {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
for (const [filename, table] of Object.entries(tables)) {
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add('Data');
  const matrix = [table.columns, ...table.rows.map(row => table.columns.map(key => row[key] ?? null))];
  const range = sheet.getRangeByIndexes(0, 0, matrix.length, table.columns.length);
  range.values = matrix;
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(1);
  range.format.font = { name: 'Arial', size: 10 };
  range.format.columnWidth = 27;
  range.format.rowHeight = 21;
  const header = sheet.getRangeByIndexes(0, 0, 1, table.columns.length);
  header.format.fill = '#25344B';
  header.format.font = { name: 'Arial', size: 10, bold: true, color: '#FFFFFF' };
  header.format.wrapText = true;
  header.format.rowHeight = 56;
  workbook.recalculate();
  console.log(filename, (await workbook.inspect({ kind: 'table', range: 'Data!A1:F3', include: 'values', tableMaxRows: 3, tableMaxCols: 6 })).ndjson);
  // CSV has no visual styling. Render representative records to check labels/values.
  const preview = await workbook.render({ sheetName: 'Data', range: 'A1:F8', scale: 1, format: 'png' });
  await fs.writeFile(path.join(staging, `${filename}.png`), new Uint8Array(await preview.arrayBuffer()));
  const authored = range.values;
  if (JSON.stringify(authored) !== JSON.stringify(matrix)) throw new Error(`Value roundtrip mismatch: ${filename}`);
  // Serialize the authored typed grid as RFC4180 CSV, UTF-8 BOM for Vietnamese Excel.
  const csv = '\uFEFF' + authored.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
  await fs.writeFile(path.join(output, filename), csv, 'utf8');
}
