import * as XLSX from 'xlsx';
import type { AnnouncementRow } from './types';

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
