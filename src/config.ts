import { DEFAULT_SOURCE_IDS, SOURCE_BY_ID } from "./sources";
import type {
  AppSettings,
  Env,
  ProxyProtocol,
  ProxySnapshot,
  RuntimeState,
} from "./types";

export const KEYS = {
  settings: "settings:v1",
  runtime: "runtime:v1",
  snapshot: "snapshot:v1",
  lock: "run-lock:v1",
  resinSubscriptionId: "resin-subscription-id:v1",
} as const;

const SUPPORTED_PROTOCOLS = new Set<ProxyProtocol>(["http", "https", "socks5"]);

export const DEFAULT_SETTINGS: AppSettings = {
  enabled: false,
  dailyTime: "03:00",
  timezone: "Asia/Shanghai",
  sourceIds: [...DEFAULT_SOURCE_IDS],
  protocols: ["http", "socks5"],
  perSourceLimit: 2_000,
  resinSubscriptionName: "Free-Proxies",
  resinUpdateInterval: "1h",
};

export const EMPTY_RUNTIME: RuntimeState = {
  running: false,
  stage: "idle",
  history: [],
};

export async function loadJson<T>(env: Env, key: string): Promise<T | null> {
  const raw = await env.STATE.get(key, "text");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function saveJson(env: Env, key: string, value: unknown): Promise<void> {
  await env.STATE.put(key, JSON.stringify(value));
}

function normalizeDailyTime(value: unknown): string {
  const match = String(value ?? "").trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) throw new Error("dailyTime must use HH:MM");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error("dailyTime is out of range");
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeTimezone(value: unknown, fallback: string): string {
  const timezone = String(value ?? fallback).trim() || fallback;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
  } catch {
    throw new Error(`invalid timezone: ${timezone}`);
  }
  return timezone;
}

function durationSeconds(value: string): number {
  if (!/^(?:\d+(?:\.\d+)?(?:h|m|s))+$/.test(value)) return -1;
  let total = 0;
  for (const match of value.matchAll(/(\d+(?:\.\d+)?)(h|m|s)/g)) {
    const number = Number(match[1]);
    const unit = match[2];
    total += number * (unit === "h" ? 3_600 : unit === "m" ? 60 : 1);
  }
  return total;
}

function normalizeInterval(value: unknown): string {
  const interval = String(value ?? DEFAULT_SETTINGS.resinUpdateInterval).trim();
  if (durationSeconds(interval) < 30) {
    throw new Error("resinUpdateInterval must be a Go duration of at least 30s");
  }
  return interval;
}

export function sanitizeSettings(input: Partial<AppSettings>, defaultTimezone = "Asia/Shanghai"): AppSettings {
  const sourceIds = Array.isArray(input.sourceIds)
    ? [...new Set(input.sourceIds.map(String))].filter((id) => SOURCE_BY_ID.has(id))
    : [...DEFAULT_SETTINGS.sourceIds];
  if (sourceIds.length === 0) throw new Error("select at least one proxy source");

  const protocols = Array.isArray(input.protocols)
    ? [...new Set(input.protocols.map(String))].filter(
        (value): value is ProxyProtocol => SUPPORTED_PROTOCOLS.has(value as ProxyProtocol),
      )
    : [...DEFAULT_SETTINGS.protocols];
  if (protocols.length === 0) throw new Error("select at least one protocol");

  const perSourceLimit = Number(input.perSourceLimit ?? DEFAULT_SETTINGS.perSourceLimit);
  if (!Number.isInteger(perSourceLimit) || perSourceLimit < 1 || perSourceLimit > 5_000) {
    throw new Error("perSourceLimit must be between 1 and 5000");
  }

  const resinSubscriptionName = String(
    input.resinSubscriptionName ?? DEFAULT_SETTINGS.resinSubscriptionName,
  ).trim();
  if (!resinSubscriptionName || resinSubscriptionName.length > 120) {
    throw new Error("resinSubscriptionName must be 1-120 characters");
  }

  return {
    enabled: Boolean(input.enabled),
    dailyTime: normalizeDailyTime(input.dailyTime ?? DEFAULT_SETTINGS.dailyTime),
    timezone: normalizeTimezone(input.timezone, defaultTimezone),
    sourceIds,
    protocols,
    perSourceLimit,
    resinSubscriptionName,
    resinUpdateInterval: normalizeInterval(input.resinUpdateInterval),
  };
}

export async function loadSettings(env: Env): Promise<AppSettings> {
  const stored = await loadJson<Partial<AppSettings>>(env, KEYS.settings);
  return sanitizeSettings(
    { ...DEFAULT_SETTINGS, ...(stored ?? {}) },
    env.DEFAULT_TIMEZONE || DEFAULT_SETTINGS.timezone,
  );
}

export async function saveSettings(env: Env, input: Partial<AppSettings>): Promise<AppSettings> {
  const settings = sanitizeSettings(input, env.DEFAULT_TIMEZONE || DEFAULT_SETTINGS.timezone);
  await saveJson(env, KEYS.settings, settings);
  return settings;
}

export async function loadRuntime(env: Env): Promise<RuntimeState> {
  const stored = await loadJson<RuntimeState>(env, KEYS.runtime);
  if (!stored) return { ...EMPTY_RUNTIME, history: [] };
  return {
    ...EMPTY_RUNTIME,
    ...stored,
    history: Array.isArray(stored.history) ? stored.history.slice(0, 20) : [],
  };
}

export async function saveRuntime(env: Env, runtime: RuntimeState): Promise<void> {
  await saveJson(env, KEYS.runtime, { ...runtime, history: runtime.history.slice(0, 20) });
}

export async function loadSnapshot(env: Env): Promise<ProxySnapshot | null> {
  return loadJson<ProxySnapshot>(env, KEYS.snapshot);
}

export async function saveSnapshot(env: Env, snapshot: ProxySnapshot): Promise<void> {
  await saveJson(env, KEYS.snapshot, snapshot);
}

export function zonedDateAndMinutes(date: Date, timezone: string): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const dateText = `${values.year}-${values.month}-${values.day}`;
  return {
    date: dateText,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
}

export function shouldRunScheduled(
  now: Date,
  settings: AppSettings,
  lastScheduledDate?: string,
): { due: boolean; scheduledDate: string } {
  const local = zonedDateAndMinutes(now, settings.timezone);
  const [hourText, minuteText] = settings.dailyTime.split(":");
  const targetMinutes = Number(hourText) * 60 + Number(minuteText);
  return {
    due: settings.enabled && local.minutes >= targetMinutes && lastScheduledDate !== local.date,
    scheduledDate: local.date,
  };
}
