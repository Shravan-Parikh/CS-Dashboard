import type {
  AnnouncementResponse,
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
  keyword?: string;
  limit?: number;
}

export function getLatest(params: LatestParams) {
  const q = new URLSearchParams({ days: String(params.days) });
  if (params.buckets?.length) q.set('buckets', params.buckets.join(','));
  if (params.index && params.index !== 'All') q.set('index', params.index);
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
export function getCompliance(opts: { fy?: number; agmDate?: string }) {
  const q = new URLSearchParams();
  if (opts.fy !== undefined) q.set('fy', String(opts.fy));
  if (opts.agmDate) q.set('agmDate', opts.agmDate);
  return request<ComplianceResponse>(`/compliance?${q}`);
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
