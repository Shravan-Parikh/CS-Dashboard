export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Company {
  company: string;
  symbol: string;
  scrip_code: string;
  indices: string[];
}

export interface AnnouncementRow {
  status?: 'matched' | 'none' | 'error';
  found: string;
  company: string;
  symbol: string;
  scrip_code: string;
  news_dt: string;
  category: string;
  subcategory: string;
  headline: string;
  pdf_url: string;
}

export interface AnnouncementMeta {
  mode: string;
  companies: number;
  totalFetched: number;
  matched: number;
  withMatch: number;
  failed?: number;
  failedScrips?: string[];
  resolved: boolean;
}

export interface AnnouncementResponse {
  rows: AnnouncementRow[];
  meta: AnnouncementMeta;
}
