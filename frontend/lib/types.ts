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
