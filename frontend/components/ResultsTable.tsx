'use client';

import { ExternalLink, FileText, Minus, AlertTriangle } from 'lucide-react';
import { pdfProxyUrl } from '@/lib/api';
import type { AnnouncementRow } from '@/lib/types';

function fmtDate(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ResultsTable({ rows }: { rows: AnnouncementRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="w-10 px-3 py-3"></th>
            <th className="px-3 py-3 font-semibold">Company</th>
            <th className="px-3 py-3 font-semibold">Date</th>
            <th className="px-3 py-3 font-semibold">Category</th>
            <th className="px-3 py-3 font-semibold">Headline</th>
            <th className="px-3 py-3 text-right font-semibold">PDF</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={`${r.scrip_code}-${i}`}
              className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
            >
              <td className="px-3 py-3">
                {r.status === 'matched' || r.found ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-600">
                    ✓
                  </span>
                ) : r.status === 'error' ? (
                  <span
                    title="Couldn't fetch this company from BSE"
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-600"
                  >
                    <AlertTriangle className="h-3 w-3" />
                  </span>
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-300">
                    <Minus className="h-3 w-3" />
                  </span>
                )}
              </td>
              <td className="px-3 py-3">
                <div className="font-medium text-slate-800">{r.company}</div>
                <div className="text-xs text-slate-400">
                  {r.symbol ? `${r.symbol} · ` : ''}
                  {r.scrip_code}
                </div>
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                {fmtDate(r.news_dt) || <span className="text-slate-300">—</span>}
              </td>
              <td className="px-3 py-3">
                {r.category ? (
                  <div>
                    <div className="text-slate-700">{r.category}</div>
                    {r.subcategory && (
                      <div className="text-xs text-slate-400">{r.subcategory}</div>
                    )}
                  </div>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>
              <td className="max-w-md px-3 py-3 text-slate-600">
                {r.status === 'error' ? (
                  <span className="text-amber-600">{r.headline}</span>
                ) : (
                  r.headline || (
                    <span className="text-slate-300">No matching filing in range</span>
                  )
                )}
              </td>
              <td className="px-3 py-3 text-right">
                {r.pdf_url ? (
                  <a
                    href={pdfProxyUrl(r.pdf_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
                  >
                    <FileText className="h-3.5 w-3.5" /> Open
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
