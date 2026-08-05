import type {
  AnnouncementResponse,
  Company,
  User,
} from './types';

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000/api';

const TOKEN_KEY = 'cs_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

// --- Auth ---
export function login(email: string, password: string) {
  return request<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function register(name: string, email: string, password: string) {
  return request<{ token: string; user: User }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
}

export function me() {
  return request<{ user: User }>('/auth/me');
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
