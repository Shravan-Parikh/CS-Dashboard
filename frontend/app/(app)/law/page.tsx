'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Scale,
  Search,
  Loader2,
  AlertCircle,
  ExternalLink,
  FileText,
  ChevronDown,
  ChevronUp,
  Zap,
  Library,
} from 'lucide-react';
import clsx from 'clsx';
import Topbar from '@/components/Topbar';
import * as api from '@/lib/api';
import type { LawDocument, LawHit, LawSearchResponse, LawChunk } from '@/lib/types';

/** Queries that show a new user what this is for. */
const EXAMPLES = [
  'trading window closure',
  'contra trade six months',
  'pre-clearance of trades',
  'structured digital database',
  'minimum standards code of conduct',
];

export default function KnowTheLawPage() {
  const [documents, setDocuments] = useState<LawDocument[]>([]);
  const [corpus, setCorpus] = useState<{ chunks: number; topics: string[] } | null>(null);

  const [query, setQuery] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [docs, setDocs] = useState<string[]>([]);

  const [res, setRes] = useState<LawSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);

  // Full clause text, fetched on demand when a hit is expanded.
  const [expanded, setExpanded] = useState<string | null>(null);
  const [chunk, setChunk] = useState<LawChunk | null>(null);
  const [chunkLoading, setChunkLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const params = useSearchParams();

  useEffect(() => {
    api
      .getLawDocuments()
      .then((r) => {
        setDocuments(r.documents);
        setCorpus(r.stats);
      })
      .catch(() => setError('Could not load the document library'));
    inputRef.current?.focus();
  }, []);

  const run = useCallback(
    async (q: string) => {
      const term = q.trim();
      if (!term) {
        setRes(null);
        return;
      }
      setLoading(true);
      setError(null);
      setExpanded(null);
      try {
        setRes(await api.searchLaw({ q: term, topics, docs, limit: 30 }));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed');
      } finally {
        setLoading(false);
      }
    },
    [topics, docs],
  );

  /**
   * Citation chips on a case order link here. `?ref=` is an exact provision
   * lookup (scoped by `?docs=`, since "Regulation 3" means something different
   * in PIT, LODR and SAST); `?q=` is an ordinary search.
   */
  useEffect(() => {
    const ref = params.get('ref');
    const docScope = params.get('docs');
    if (ref) {
      setQuery(ref);
      setLoading(true);
      setError(null);
      api
        .lookupLaw(ref, docScope ? docScope.split(',') : undefined)
        .then((r) => {
          if (r.results.length === 0) {
            setError(`No provision found for “${ref}”.`);
            setRes(null);
            return;
          }
          setRes({
            query: ref,
            results: r.results,
            meta: {
              total: r.meta.total,
              returned: r.results.length,
              tokens: [],
              elapsedMs: 0,
              corpus: { documents: 0, chunks: 0, topics: [], authorities: [], builtAt: '' },
            },
          });
        })
        .catch(() => setError('Could not load that provision'))
        .finally(() => setLoading(false));
      return;
    }
    const incoming = params.get('q');
    if (incoming) {
      setQuery(incoming);
      run(incoming);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // Re-run when filters change, but only if there's already a query.
  useEffect(() => {
    if (query.trim()) run(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics, docs]);

  async function toggleExpand(hit: LawHit) {
    if (expanded === hit.id) {
      setExpanded(null);
      setChunk(null);
      return;
    }
    setExpanded(hit.id);
    setChunk(null);
    setChunkLoading(true);
    try {
      const r = await api.getLawChunk(hit.id);
      setChunk(r.chunk);
    } catch {
      setChunk(null);
    } finally {
      setChunkLoading(false);
    }
  }

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <>
      <Topbar
        title="Know the Law"
        subtitle="Search SEBI regulations by clause, with citations"
      />

      <div className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6">
        <div className="mx-auto max-w-4xl space-y-5">
          {/* ---------------- Search ---------------- */}
          <div className="card p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(query);
              }}
            >
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                <input
                  ref={inputRef}
                  className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-11 pr-24 text-sm text-slate-800 placeholder-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search the regulations — e.g. “how long is the contra trade restriction?”"
                />
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
                </button>
              </div>
            </form>

            {/* Filters */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Filter
              </span>
              {(corpus?.topics || []).map((t) => (
                <button
                  key={t}
                  onClick={() => toggle(topics, setTopics, t)}
                  className={clsx(
                    'rounded-full border px-2.5 py-1 text-xs font-medium transition',
                    topics.includes(t)
                      ? 'border-brand-200 bg-brand-50 text-brand-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
                  )}
                >
                  {t}
                </button>
              ))}
              <span className="mx-1 h-4 w-px bg-slate-200" />
              {documents.map((d) => (
                <button
                  key={d.id}
                  onClick={() => toggle(docs, setDocs, d.id)}
                  title={d.title}
                  className={clsx(
                    'rounded-full border px-2.5 py-1 text-xs font-medium transition',
                    docs.includes(d.id)
                      ? 'border-brand-200 bg-brand-50 text-brand-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
                  )}
                >
                  {d.topics[0] || d.kind}
                </button>
              ))}
              {(topics.length > 0 || docs.length > 0) && (
                <button
                  onClick={() => {
                    setTopics([]);
                    setDocs([]);
                  }}
                  className="ml-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  Clear
                </button>
              )}
            </div>

            {!res && !loading && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-400">Try:</span>
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => {
                      setQuery(ex);
                      run(ex);
                    }}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {/* ---------------- Results ---------------- */}
          {res && (
            <>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <b>{res.meta.total}</b> passage{res.meta.total === 1 ? '' : 's'} matched
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                  <Zap className="h-3 w-3" />
                  {res.meta.elapsedMs}ms
                </span>
                {res.meta.total > res.meta.returned && (
                  <span className="text-xs text-slate-400">
                    showing the top {res.meta.returned}
                  </span>
                )}
              </div>

              {res.results.length === 0 ? (
                <div className="card py-16 text-center text-sm text-slate-400">
                  Nothing matched “{res.query}”. Try fewer or more common words.
                </div>
              ) : (
                <ul className="space-y-2">
                  {res.results.map((hit) => {
                    const open = expanded === hit.id;
                    return (
                      <li key={hit.id} className="card overflow-hidden">
                        <div className="p-4">
                          <div className="mb-1.5 flex flex-wrap items-center gap-2">
                            <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">
                              {hit.ref}
                            </span>
                            {hit.heading && (
                              <span className="text-sm font-medium text-slate-800">
                                {hit.heading}
                              </span>
                            )}
                            <span className="text-[11px] text-slate-400">
                              {hit.topics[0] || hit.kind} · page {hit.page}
                            </span>
                          </div>

                          {/* Snippet HTML is built and escaped server-side; only
                              <mark> spans are injected. */}
                          <p
                            className="text-[13px] leading-relaxed text-slate-600 [&_mark]:rounded [&_mark]:bg-amber-100 [&_mark]:px-0.5 [&_mark]:text-slate-900"
                            dangerouslySetInnerHTML={{ __html: hit.snippet }}
                          />

                          <div className="mt-2.5 flex flex-wrap items-center gap-3">
                            <button
                              onClick={() => toggleExpand(hit)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                            >
                              {open ? (
                                <>
                                  Hide full text <ChevronUp className="h-3 w-3" />
                                </>
                              ) : (
                                <>
                                  Read full clause <ChevronDown className="h-3 w-3" />
                                </>
                              )}
                            </button>
                            <a
                              href={`${documents.find((d) => d.id === hit.docId)?.pdfUrl || '#'}#page=${hit.page}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
                            >
                              <FileText className="h-3 w-3" /> Source PDF, p.{hit.page}
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                            <span className="text-[11px] text-slate-400">
                              {hit.docTitle.replace(/^SEBI \(/, '').replace(/\).*$/, '')}
                            </span>
                          </div>
                        </div>

                        {open && (
                          <div className="border-t border-slate-100 bg-slate-50/70 p-4">
                            {chunkLoading ? (
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading the
                                clause…
                              </div>
                            ) : chunk ? (
                              <>
                                {chunk.chapter && (
                                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                    {chunk.chapter}
                                  </p>
                                )}
                                <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-slate-700">
                                  {chunk.text}
                                </pre>
                              </>
                            ) : (
                              <p className="text-xs text-slate-400">
                                Could not load the full text.
                              </p>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}

          {/* ---------------- Document library ---------------- */}
          <div className="card overflow-hidden">
            <button
              onClick={() => setShowLibrary((v) => !v)}
              className="flex w-full items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Library className="h-4 w-4 text-slate-400" />
                Document library
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                  {documents.length}
                </span>
              </span>
              {showLibrary ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>

            {showLibrary && (
              <ul className="divide-y divide-slate-100">
                {documents.map((d) => (
                  <li key={d.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800">{d.title}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {d.authority} · {d.kind} · {d.pages} pages · {d.chunkCount}{' '}
                          citable passages
                        </p>
                        {d.note && (
                          <p className="mt-1 text-xs text-slate-500">{d.note}</p>
                        )}
                        <p className="mt-1 font-mono text-[10px] text-slate-300">
                          {d.sha256.slice(0, 16)} · ingested{' '}
                          {new Date(d.fetchedAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <a
                          href={d.sourcePage}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 px-2 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                        >
                          SEBI page <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                        <a
                          href={d.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 px-2 text-[11px] font-medium text-brand-600 hover:bg-brand-50"
                        >
                          <FileText className="h-3 w-3" /> PDF
                        </a>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
            <Scale className="mt-0.5 h-4 w-4 shrink-0" />
            Text is extracted from SEBI&apos;s own published PDFs and cited by regulation
            and page. Amendment footnotes are stripped for readability, so always confirm
            against the source PDF before relying on a clause.
          </p>
        </div>
      </div>
    </>
  );
}
