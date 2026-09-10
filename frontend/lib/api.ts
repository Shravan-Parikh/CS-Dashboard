import type {
  AnnouncementResponse,
  CaseOrder,
  CaseSearchResponse,
  CaseStats,
  BoardMeeting,
  MeetingType,
  Task,
  TimelineItem,
  LawChunk,
  LawCorpusStats,
  LawDocument,
  LawSearchResponse,
  Company,
  CompanyTimelineResponse,
  ComplianceResponse,
  CsBucket,
  LatestResponse,
  User,
} from './types';

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000/api';

const TOKEN_KEY = 'cs_token';
const REFRESH_KEY = 'cs_refresh';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export function setRefreshToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(REFRESH_KEY, token);
  else window.localStorage.removeItem(REFRESH_KEY);
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

/** Store a whole session at once (login / refresh both return this shape). */
export function setSession(s: { token: string; refreshToken?: string }) {
  setToken(s.token);
  if (s.refreshToken) setRefreshToken(s.refreshToken);
}

export function clearSession() {
  setToken(null);
  setRefreshToken(null);
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Firebase ID tokens expire after an hour, so a 401 is usually just staleness
 * rather than a real sign-out. Swap the refresh token for a fresh ID token and
 * replay the request once. Concurrent 401s share one refresh.
 */
let refreshInFlight: Promise<string | null> | null = null;

async function refreshSession(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) {
          clearSession();
          return null;
        }
        const data = await res.json();
        setSession(data);
        return data.token as string;
      })
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

async function send(path: string, options: RequestInit, token: string | null) {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await send(path, options, getToken());

  if (res.status === 401 && getRefreshToken()) {
    const fresh = await refreshSession();
    if (fresh) res = await send(path, options, fresh);
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

// --- Auth ---
export interface Session {
  token: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

export function login(email: string, password: string) {
  return request<Session>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function register(name: string, email: string, password: string) {
  return request<Session>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
}

export function me() {
  return request<{ user: User }>('/auth/me');
}

/** Always resolves for any well-formed address — it never reveals whether an account exists. */
export function forgotPassword(email: string) {
  return request<{ ok: true; message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

// --- Workspace (persisted in Firestore) ---
export interface WatchlistCompany {
  scrip_code: string;
  company: string;
  symbol: string;
}

export function getWatchlist() {
  return request<{ companies: WatchlistCompany[] }>('/workspace/watchlist');
}

export function saveWatchlist(companies: WatchlistCompany[]) {
  return request<{ companies: WatchlistCompany[] }>('/workspace/watchlist', {
    method: 'PUT',
    body: JSON.stringify({ companies }),
  });
}

export interface SavedView {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  createdAt: string;
}

export function getSavedViews() {
  return request<{ views: SavedView[] }>('/workspace/views');
}

export function saveView(name: string, filters: Record<string, unknown>) {
  return request<{ view: SavedView; views: SavedView[] }>('/workspace/views', {
    method: 'POST',
    body: JSON.stringify({ name, filters }),
  });
}

export function deleteView(id: string) {
  return request<{ views: SavedView[] }>(`/workspace/views/${id}`, {
    method: 'DELETE',
  });
}

// --- Reference data ---
export function getIndices() {
  return request<{ indices: string[] }>('/indices');
}

export function getCategories() {
  return request<{ categories: string[] }>('/categories');
}

export function getCompanies(index: string) {
  return request<{ companies: Company[] }>(
    `/companies?index=${encodeURIComponent(index)}`,
  );
}

// --- Announcements ---
export interface FetchParams {
  companies: { scrip_code: string; company: string; symbol: string }[];
  from: string;
  to: string;
  category: string;
  keyword: string;
  mode: 'latest' | 'all';
}

export function fetchAnnouncements(params: FetchParams) {
  return request<AnnouncementResponse>('/announcements', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// --- CS-relevant latest feed ---
export function getCsBuckets() {
  return request<{ buckets: CsBucket[] }>('/announcements/buckets');
}

export interface LatestParams {
  days: number;
  buckets?: string[];
  index?: string;
  /** Narrow the market-wide sweep to specific scrip codes (e.g. a watchlist). */
  scrips?: string[];
  keyword?: string;
  limit?: number;
}

export function getLatest(params: LatestParams) {
  const q = new URLSearchParams({ days: String(params.days) });
  if (params.buckets?.length) q.set('buckets', params.buckets.join(','));
  if (params.scrips?.length) q.set('scrips', params.scrips.join(','));
  else if (params.index && params.index !== 'All') q.set('index', params.index);
  if (params.keyword) q.set('keyword', params.keyword);
  if (params.limit) q.set('limit', String(params.limit));
  return request<LatestResponse>(`/announcements/latest?${q}`);
}

// --- Company 360 ---
export function getCompanyTimeline(scrip: string, months = 12) {
  return request<CompanyTimelineResponse>(
    `/company/${encodeURIComponent(scrip)}?months=${months}`,
  );
}

// --- Compliance calendar ---
export function getCompliance(opts: {
  fy?: number;
  agmDate?: string;
  /** listed | unlisted-public | private | opc — defaults to listed. */
  type?: string;
}) {
  const q = new URLSearchParams();
  if (opts.fy !== undefined) q.set('fy', String(opts.fy));
  if (opts.agmDate) q.set('agmDate', opts.agmDate);
  if (opts.type) q.set('type', opts.type);
  return request<ComplianceResponse>(`/compliance?${q}`);
}

// --- Know the Law (statutory corpus) ---
export function getLawDocuments() {
  return request<{ documents: LawDocument[]; stats: LawCorpusStats }>('/law/documents');
}

export function searchLaw(params: {
  q: string;
  topics?: string[];
  docs?: string[];
  limit?: number;
}) {
  const qs = new URLSearchParams({ q: params.q });
  if (params.topics?.length) qs.set('topics', params.topics.join(','));
  if (params.docs?.length) qs.set('docs', params.docs.join(','));
  if (params.limit) qs.set('limit', String(params.limit));
  return request<LawSearchResponse>(`/law/search?${qs}`);
}

/** Expand a search hit to its full clause text. */
export function getLawChunk(id: string) {
  return request<{ chunk: LawChunk }>(`/law/chunk?id=${encodeURIComponent(id)}`);
}

// --- Tasks ---
export function getTasks() {
  return request<{ tasks: Task[] }>('/tasks');
}

export type TaskInput = Partial<Omit<Task, 'id' | 'createdAt' | 'completedAt'>>;

export function createTask(input: TaskInput) {
  return request<{ task: Task; tasks: Task[]; duplicate?: boolean }>('/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateTask(id: string, input: TaskInput) {
  return request<{ task: Task; tasks: Task[] }>(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteTask(id: string) {
  return request<{ tasks: Task[] }>(`/tasks/${id}`, { method: 'DELETE' });
}

export function clearCompletedTasks() {
  return request<{ tasks: Task[]; removed: number }>('/tasks/clear-completed', {
    method: 'POST',
  });
}

// --- Board meetings ---
export function getMeetingTypes() {
  return request<{ types: MeetingType[]; statuses: string[] }>('/meetings/types');
}

export function getMeetings() {
  return request<{ meetings: BoardMeeting[] }>('/meetings');
}

export type MeetingInput = Partial<Omit<BoardMeeting, 'id' | 'createdAt' | 'timeline'>>;

export function createMeeting(input: MeetingInput) {
  return request<{ meeting: BoardMeeting }>('/meetings', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateMeeting(id: string, input: MeetingInput) {
  return request<{ meeting: BoardMeeting }>(`/meetings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteMeeting(id: string) {
  return request<{ ok: true }>(`/meetings/${id}`, { method: 'DELETE' });
}

/** Preview the statutory timeline for a date before committing to it. */
export function previewTimeline(params: {
  date: string;
  type: string;
  hasResults?: boolean;
  listed?: boolean;
}) {
  const q = new URLSearchParams({ date: params.date, type: params.type });
  if (params.hasResults) q.set('hasResults', 'true');
  if (params.listed === false) q.set('listed', 'false');
  return request<{ timeline: TimelineItem[] }>(`/meetings/timeline?${q}`);
}

// --- PIT / UPSI case law ---
export interface CaseQuery {
  q?: string;
  years?: string[];
  authorities?: string[];
  orderTypes?: string[];
  outcomes?: string[];
  bands?: string[];
  citations?: string[];
  company?: string;
  sort?: 'recent' | 'relevance' | 'penalty' | 'oldest';
  limit?: number;
  offset?: number;
}

export function getCaseFacets() {
  return request<{
    stats: CaseStats;
    penaltyBands: { id: string; label: string }[];
  }>('/cases/facets');
}

export function searchCases(p: CaseQuery) {
  const q = new URLSearchParams();
  if (p.q) q.set('q', p.q);
  for (const k of ['years', 'authorities', 'orderTypes', 'outcomes', 'bands', 'citations'] as const) {
    const v = p[k];
    if (v?.length) q.set(k, v.join(','));
  }
  if (p.company) q.set('company', p.company);
  if (p.sort) q.set('sort', p.sort);
  if (p.limit) q.set('limit', String(p.limit));
  if (p.offset) q.set('offset', String(p.offset));
  return request<CaseSearchResponse>(`/cases?${q}`);
}

/** Full order text for the detail view. */
export function getCase(id: string) {
  return request<{ case: CaseOrder }>(`/cases/${encodeURIComponent(id)}`);
}

// --- PDF helpers (go through backend proxy) ---
export function pdfProxyUrl(bseUrl: string) {
  return `${API_BASE}/pdf?url=${encodeURIComponent(bseUrl)}`;
}

export async function downloadZip(
  items: { url: string; name: string }[],
  filename: string,
): Promise<Blob> {
  const res = await fetch(`${API_BASE}/export/zip`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ items, filename }),
  });
  if (!res.ok) throw new Error('ZIP export failed');
  return res.blob();
}
