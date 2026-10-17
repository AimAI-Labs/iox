export interface WebSession {
  id: string;
  actionId: string;
  platform: string;
  title: string;
  url: string;
  dateStart: number | null;
  dateEnd: number | null;
  precision: 'exact' | 'day' | 'range' | 'unknown';
  dateLabel: string;
  sourceOrder: number;
}

export interface PlatformSync {
  actionId: string;
  platform: string;
  status: 'queued' | 'collecting' | 'ready' | 'empty' | 'partial' | 'login_required' | 'unavailable' | 'error';
  count: number;
  syncedAt: number | null;
  error: string | null;
}

export interface WebHistory {
  version: number;
  sessions: WebSession[];
  platforms: PlatformSync[];
}
