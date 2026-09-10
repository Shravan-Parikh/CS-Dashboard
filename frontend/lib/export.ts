import * as XLSX from 'xlsx';
import type { AnnouncementRow, CaseOrder, ComplianceOccurrence, LatestRow } from './types';

const COLUMNS: { key: keyof AnnouncementRow; label: string }[] = [
  { key: 'company', label: 'Company' },
  { key: 'symbol', label: 'Symbol' },
  { key: 'scrip_code', label: 'Scrip Code' },
  { key: 'news_dt', label: 'Date/Time' },
  { key: 'category', label: 'Category' },
  { key: 'subcategory', label: 'Sub-category' },
  { key: 'headline', label: 'Headline' },
  { key: 'pdf_url', label: 'PDF' },
];

function toRecords(rows: AnnouncementRow[]) {
  return rows.map((r) => {
    const rec: Record<string, string> = {};
    COLUMNS.forEach((c) => (rec[c.label] = r[c.key] ?? ''));
    return rec;
  });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportCsv(rows: AnnouncementRow[], filename: string) {
  const records = toRecords(rows);
  const header = COLUMNS.map((c) => c.label);
  const escape = (v: string) =>
    /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const lines = [
    header.join(','),
    ...records.map((rec) => header.map((h) => escape(rec[h] ?? '')).join(',')),
  ];
  triggerDownload(new Blob([lines.join('\n')], { type: 'text/csv' }), filename);
}

export function exportXlsx(rows: AnnouncementRow[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(toRecords(rows));
  ws['!cols'] = [
    { wch: 28 },
    { wch: 12 },
    { wch: 10 },
    { wch: 20 },
    { wch: 20 },
    { wch: 26 },
    { wch: 60 },
    { wch: 70 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Announcements');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  triggerDownload(
    new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    filename,
  );
}

// --- Generic writers, so each new row shape needs only a column map ---

interface Column<T> {
  label: string;
  get: (row: T) => string;
}

function records<T>(rows: T[], cols: Column<T>[]) {
  return rows.map((r) => {
    const rec: Record<string, string> = {};
    cols.forEach((c) => (rec[c.label] = c.get(r) ?? ''));
    return rec;
  });
}

function writeCsv<T>(rows: T[], cols: Column<T>[], filename: string) {
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [
    cols.map((c) => c.label).join(','),
    ...rows.map((r) => cols.map((c) => escape(c.get(r) ?? '')).join(',')),
  ];
  triggerDownload(new Blob([lines.join('\n')], { type: 'text/csv' }), filename);
}

function writeXlsx<T>(
  rows: T[],
  cols: Column<T>[],
  widths: number[],
  sheet: string,
  filename: string,
) {
  const ws = XLSX.utils.json_to_sheet(records(rows, cols));
  ws['!cols'] = widths.map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  triggerDownload(
    new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    filename,
  );
}

// --- CS-relevant latest feed ---

const LATEST_COLS: Column<LatestRow>[] = [
  { label: 'Date/Time', get: (r) => r.news_dt },
  { label: 'Company', get: (r) => r.company },
  { label: 'Symbol', get: (r) => r.symbol },
  { label: 'Scrip Code', get: (r) => r.scrip_code },
  { label: 'CS Bucket', get: (r) => r.bucketLabel },
  { label: 'Regulation', get: (r) => r.reference },
  { label: 'Category', get: (r) => r.category },
  { label: 'Sub-category', get: (r) => r.subcategory },
  { label: 'Headline', get: (r) => r.headline },
  { label: 'PDF', get: (r) => r.pdf_url },
];

export function exportLatestCsv(rows: LatestRow[], filename: string) {
  writeCsv(rows, LATEST_COLS, filename);
}

export function exportLatestXlsx(rows: LatestRow[], filename: string) {
  writeXlsx(
    rows,
    LATEST_COLS,
    [20, 30, 12, 10, 22, 24, 20, 30, 65, 70],
    'CS Feed',
    filename,
  );
}

// --- Compliance calendar ---

const COMPLIANCE_COLS: Column<ComplianceOccurrence>[] = [
  { label: 'Due Date', get: (o) => o.due },
  { label: 'Obligation', get: (o) => o.title },
  { label: 'Authority', get: (o) => o.authority },
  { label: 'Provision', get: (o) => o.reference },
  { label: 'Type', get: (o) => o.kind },
  { label: 'Period', get: (o) => o.period },
  { label: 'Financial Year', get: (o) => o.fy },
  { label: 'Notes', get: (o) => o.note },
];

export function exportComplianceCsv(rows: ComplianceOccurrence[], filename: string) {
  writeCsv(rows, COMPLIANCE_COLS, filename);
}

export function exportComplianceXlsx(rows: ComplianceOccurrence[], filename: string) {
  writeXlsx(
    rows,
    COMPLIANCE_COLS,
    [12, 48, 18, 32, 12, 16, 14, 70],
    'Compliance Calendar',
    filename,
  );
}

// --- PIT case law ---

const rupees = (n: number) => (n ? n.toLocaleString('en-IN') : '');

const CASE_COLS: Column<CaseOrder>[] = [
  { label: 'Date', get: (c) => c.orderDate || c.period },
  { label: 'Order No.', get: (c) => c.orderNo },
  { label: 'Forum', get: (c) => c.authority },
  { label: 'Order Type', get: (c) => c.orderTypeLabel },
  { label: 'Company / Party', get: (c) => c.company || c.subject },
  { label: 'Outcome', get: (c) => c.outcome },
  { label: 'Penalty (Rs)', get: (c) => rupees(c.penalty) },
  { label: 'Penalty Detected', get: (c) => (c.penaltyDetected ? 'Yes' : 'No') },
  { label: 'UPSI', get: (c) => (c.upsi || []).join('; ') },
  { label: 'Provisions Cited', get: (c) => (c.citations || []).join('; ') },
  { label: 'Title', get: (c) => c.title },
  { label: 'Order PDF', get: (c) => c.pdfUrl },
  { label: 'SEBI Page', get: (c) => c.url },
];

export function exportCasesCsv(rows: CaseOrder[], filename: string) {
  writeCsv(rows, CASE_COLS, filename);
}

export function exportCasesXlsx(rows: CaseOrder[], filename: string) {
  writeXlsx(
    rows,
    CASE_COLS,
    [12, 28, 8, 20, 34, 14, 16, 10, 26, 44, 70, 60, 60],
    'PIT Case Law',
    filename,
  );
}
