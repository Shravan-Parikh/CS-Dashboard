'use client';

import { useEffect, useState } from 'react';
import { X, Copy, Check, Download, ExternalLink, Sparkles } from 'lucide-react';
import { pdfProxyUrl } from '@/lib/api';

export interface SummaryTarget {
  company: string;
  symbol?: string;
  scrip_code: string;
  headline: string;
  category?: string;
  subcategory?: string;
  news_dt?: string;
  pdf_url: string;
}

/**
 * We don't run the model ourselves — no inference budget during the pilot. So
 * instead of a half-working summariser, hand the CS a prompt worth pasting: the
 * filing's context is baked in, and the questions are the ones a Company
 * Secretary actually needs answered, not "summarise this document".
 */
function buildPrompt(t: SummaryTarget) {
  const when = t.news_dt ? new Date(t.news_dt).toLocaleString('en-IN') : '';
  return `You are assisting a Company Secretary in India. I am attaching a corporate filing PDF from BSE.

Filing context
- Company: ${t.company}${t.symbol ? ` (${t.symbol})` : ''}, BSE scrip ${t.scrip_code}
- Category: ${[t.category, t.subcategory].filter(Boolean).join(' / ') || 'not stated'}
- Filed: ${when || 'see document'}
- Headline: ${t.headline}

Please answer in this order, and keep it tight:

1. What this filing actually says — 3 to 5 bullets, plain English, no boilerplate.
2. Every date in it that matters — board meeting dates, record date, book closure, effective dates, cut-offs. Flag anything already past.
3. Which provision it was filed under — SEBI LODR regulation, Companies Act section, SEBI PIT or SAST, as applicable. If the document cites one, quote it; if you are inferring, say so.
4. What a Company Secretary must do as a consequence — filings to make, registers to update, intimations to send, disclosures triggered, approvals needed. If nothing, say "no action".
5. Anything unusual — inconsistencies, missing annexures, dates that don't add up, or language suggesting a related event not yet disclosed.

Rules: quote the document for anything material. If something is not stated in the PDF, say "not stated in the filing" rather than guessing. Do not summarise the standard SEBI footer text.`;
}

export default function AiSummaryModal({
  target,
  onClose,
}: {
  target: SummaryTarget | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!target) return;
    setCopied(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [target, onClose]);

  if (!target) return null;
  const prompt = buildPrompt(target);
  const pdf = pdfProxyUrl(target.pdf_url);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (insecure origin, permissions). The textarea
      // below is selectable, so there's always a manual path.
      setCopied(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden />

      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900">Summarise this filing</h2>
              <p className="truncate text-xs text-slate-400">{target.company}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <ol className="mb-4 space-y-2 text-sm text-slate-600">
            <Step n={1}>
              <a
                href={pdf}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline"
              >
                Download the PDF <Download className="h-3 w-3" />
              </a>
            </Step>
            <Step n={2}>
              Copy the prompt below and paste it into{' '}
              <a
                href="https://claude.ai/new"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-brand-600 hover:underline"
              >
                Claude
              </a>{' '}
              or{' '}
              <a
                href="https://chatgpt.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-brand-600 hover:underline"
              >
                ChatGPT
              </a>
              , attaching the PDF.
            </Step>
            <Step n={3}>
              Check anything material against the filing itself before you act on it.
            </Step>
          </ol>

          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Prompt — context already filled in
            </span>
            <button
              onClick={copy}
              className={
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ' +
                (copied
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-brand-600 text-white hover:bg-brand-700')
              }
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy prompt
                </>
              )}
            </button>
          </div>

          <textarea
            readOnly
            value={prompt}
            onFocus={(e) => e.currentTarget.select()}
            className="h-64 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />

          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
            The summary is produced by an external AI tool, not by CS Dashboard — treat it as
            a reading aid, not advice. Don&apos;t paste anything unpublished or
            price-sensitive into a public AI tool; these BSE filings are already public.
          </p>
        </div>

        <footer className="flex shrink-0 flex-wrap gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <a
            href={pdf}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary flex-1 sm:flex-none"
          >
            <Download className="h-4 w-4" /> Open PDF
          </a>
          <a
            href="https://claude.ai/new"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary flex-1 sm:flex-none"
          >
            Claude <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="https://chatgpt.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary flex-1 sm:flex-none"
          >
            ChatGPT <ExternalLink className="h-3 w-3" />
          </a>
        </footer>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">
        {n}
      </span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}
