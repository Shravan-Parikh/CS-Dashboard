export interface User {
  id: string;
  name: string;
  email: string;
  role?: 'admin' | 'member';
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

// --- CS-relevant latest feed ---

export interface CsBucket {
  id: string;
  label: string;
  why: string;
  reference?: string;
  filterCount: number;
}

export interface LatestRow {
  scrip_code: string;
  company: string;
  symbol: string;
  headline: string;
  category: string;
  subcategory: string;
  news_dt: string;
  news_id: string;
  pdf_url: string;
  bucket: string;
  bucketLabel: string;
  reference: string;
  inUniverse: boolean;
}

export interface LatestMeta {
  from: string;
  to: string;
  days: number;
  windows: number;
  slices: number;
  failedSlices: number;
  buckets: string[];
  perBucket: Record<string, number>;
  total: number;
  returned: number;
  truncated: boolean;
  scoped?: 'market' | 'index' | 'scrips';
  fetchedAt?: string;
  elapsedMs: number;
}

export interface LatestResponse {
  rows: LatestRow[];
  meta: LatestMeta;
}

// --- Company 360 ---

export interface CompanyTimelineRow {
  scrip_code: string;
  company: string;
  headline: string;
  category: string;
  subcategory: string;
  news_dt: string;
  news_id: string;
  pdf_url: string;
  bucket: string;
  bucketLabel: string;
}

export interface CompanyTimelineResponse {
  company: {
    scrip_code: string;
    company: string;
    symbol: string;
    inUniverse: boolean;
  };
  rows: CompanyTimelineRow[];
  meta: {
    from: string;
    to: string;
    months: number;
    total: number;
    csRelevant: number;
    byCategory: Record<string, number>;
    byBucket: Record<string, number>;
  };
}

// --- Compliance calendar ---

export interface ComplianceOccurrence {
  id: string;
  ruleId: string;
  title: string;
  authority: string;
  reference: string;
  kind: string;
  note: string;
  period: string;
  due: string;
  fy: string;
}

export interface ComplianceEvent {
  id: string;
  title: string;
  authority: string;
  reference: string;
  trigger: string;
  deadline: string;
}

export interface ComplianceResponse {
  occurrences: ComplianceOccurrence[];
  events: ComplianceEvent[];
  meta: {
    scope: {
      type: 'fy' | 'range';
      fy?: number;
      label?: string;
      from: string;
      to: string;
      fyFrom?: string;
      fyTo?: string;
      spillsBeyondFy?: boolean;
    };
    today: string;
    agmDate: string | null;
    agmAssumed: boolean;
    companyType: string;
    companyTypeLabel: string;
    companyTypeNote: string;
    companyTypes: { id: string; label: string; note: string }[];
    total: number;
    upcoming: number;
    overdue: number;
    byAuthority: Record<string, number>;
    authorities: string[];
    ruleCount: number;
    eventRuleCount: number;
    disclaimer: string;
  };
}

// --- Law corpus (Know the Law) ---

export interface LawDocument {
  id: string;
  title: string;
  authority: string;
  kind: string;
  topics: string[];
  note?: string;
  sourcePage: string;
  pdfUrl: string;
  pages: number;
  bytes: number;
  sha256: string;
  fetchedAt: string;
  chars: number;
  chunkCount: number;
}

export interface LawCorpusStats {
  documents: number;
  chunks: number;
  topics: string[];
  authorities: string[];
  builtAt: string;
}

export interface LawHit {
  id: string;
  docId: string;
  docTitle: string;
  authority: string;
  kind: string;
  topics: string[];
  ref: string;
  heading: string;
  chapter: string;
  page: number;
  score: number;
  /** Pre-highlighted with <mark> spans; HTML-escaped server-side. */
  snippet: string;
}

export interface LawSearchResponse {
  query: string;
  results: LawHit[];
  meta: {
    total: number;
    returned: number;
    tokens: string[];
    elapsedMs: number;
    corpus: LawCorpusStats;
  };
}

export interface LawChunk {
  id: string;
  docId: string;
  docTitle: string;
  ref: string;
  heading: string;
  chapter: string;
  page: number;
  text: string;
}
