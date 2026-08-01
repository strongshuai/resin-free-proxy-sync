export interface KVNamespace {
  get(key: string, type?: "text"): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

export interface ScheduledController {
  scheduledTime: number;
  cron: string;
}

export interface Env {
  STATE: KVNamespace;
  ADMIN_TOKEN?: string;
  RESIN_API_BASE?: string;
  RESIN_ADMIN_TOKEN?: string;
  FEED_TOKEN?: string;
  DEFAULT_TIMEZONE?: string;
}

export type ProxyProtocol = "http" | "https" | "socks5";
export type SourceKind = "plain" | "proxifly" | "spysme" | "myproxy";

export interface ProxySource {
  id: string;
  name: string;
  url: string;
  kind: SourceKind;
  protocol?: ProxyProtocol;
}

export interface ProxyRecord {
  uri: string;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  sourceId: string;
  country: string;
}

export interface SourceResult {
  id: string;
  name: string;
  count: number;
  elapsedMs: number;
  error?: string;
}

export interface AppSettings {
  enabled: boolean;
  dailyTime: string;
  timezone: string;
  sourceIds: string[];
  protocols: ProxyProtocol[];
  perSourceLimit: number;
  resinSubscriptionName: string;
  resinUpdateInterval: string;
}

export type RunReason = "manual" | "schedule";
export type RunStage = "idle" | "fetching" | "saving" | "pushing" | "completed" | "failed";

export interface ResinPushResult {
  action: "created" | "updated";
  subscriptionId: string;
  refreshOk: boolean;
  nodeCount?: number;
}

export interface RunSummary {
  runId: string;
  reason: RunReason;
  status: "completed" | "failed";
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  proxyCount: number;
  sourceResults: SourceResult[];
  resin?: ResinPushResult;
  error?: string;
}

export interface RuntimeState {
  running: boolean;
  runId?: string;
  reason?: RunReason;
  stage: RunStage;
  startedAt?: string;
  lastScheduledDate?: string;
  lastResult?: RunSummary;
  history: RunSummary[];
}

export interface ProxySnapshot {
  generatedAt: string;
  count: number;
  lines: string[];
  sourceCounts: Record<string, number>;
  protocolCounts: Record<string, number>;
}
