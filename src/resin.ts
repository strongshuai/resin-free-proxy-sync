import { KEYS } from "./config";
import type { Env, ProxyRecord, ResinPushResult } from "./types";

interface ResinSubscription {
  id?: string;
  name?: string;
  source_type?: string;
  node_count?: number;
}

function isIpv4Literal(hostname: string): boolean {
  const parts = hostname.split(".");
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

export function normalizeResinApiBase(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) throw new Error("RESIN_API_BASE is not configured");

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("RESIN_API_BASE must be a valid HTTP or HTTPS URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("RESIN_API_BASE must use HTTP or HTTPS");
  }

  // Workers rejects outbound HTTP requests to a bare IPv4 address with error 1003.
  if (url.protocol === "http:" && isIpv4Literal(url.hostname)) {
    url.hostname = `${url.hostname.replace(/\./g, "-")}.sslip.io`;
  }
  return url.toString().replace(/\/+$/, "");
}

function resinBase(env: Env): string {
  return normalizeResinApiBase(env.RESIN_API_BASE);
}

function resinHeaders(env: Env): HeadersInit {
  const token = String(env.RESIN_ADMIN_TOKEN ?? "").trim();
  if (!token) throw new Error("RESIN_ADMIN_TOKEN is not configured");
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json; charset=utf-8",
    "User-Agent": "resin-free-proxy-sync/1.0",
  };
}

async function resinFetch(env: Env, path: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(`${resinBase(env)}${path}`, {
      ...init,
      headers: { ...resinHeaders(env), ...(init.headers ?? {}) },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Resin ${init.method ?? "GET"} ${path} request failed: ${message}`);
  }
}

async function responseDetail(response: Response): Promise<string> {
  const text = (await response.text()).trim();
  if (!text) return response.statusText;
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    const error = data.error;
    if (error && typeof error === "object") {
      const detail = error as Record<string, unknown>;
      return String(detail.message ?? detail.code ?? text).slice(0, 500);
    }
  } catch {
    // Plain-text errors are returned below.
  }
  return text.slice(0, 500);
}

async function resinRequest<T>(
  env: Env,
  path: string,
  init: RequestInit = {},
  acceptedStatuses: number[] = [200],
): Promise<T> {
  const response = await resinFetch(env, path, init);
  if (!acceptedStatuses.includes(response.status)) {
    throw new Error(`Resin ${init.method ?? "GET"} ${path} failed: ${response.status} ${await responseDetail(response)}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function findSubscription(env: Env, id: string, name: string): Promise<ResinSubscription | null> {
  if (id) {
    const response = await resinFetch(env, `/api/v1/subscriptions/${encodeURIComponent(id)}`);
    if (response.ok) return response.json() as Promise<ResinSubscription>;
    if (response.status !== 404) {
      throw new Error(`Resin GET subscription failed: ${response.status} ${await responseDetail(response)}`);
    }
  }

  const data = await resinRequest<{ items?: ResinSubscription[] } | ResinSubscription[]>(
    env,
    "/api/v1/subscriptions?limit=200&offset=0&sort_by=created_at&sort_order=desc",
  );
  const items = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
  return items.find((item) => String(item.name ?? "").trim() === name) ?? null;
}

export function buildSubscriptionContent(records: ProxyRecord[], generatedAt = new Date()): string {
  const lines = records.map((record) => record.uri);
  return [
    `# resin-free-proxy-sync generated=${generatedAt.toISOString()}`,
    `# count=${lines.length}`,
    ...lines,
    "",
  ].join("\n");
}

export async function upsertResinSubscription(
  env: Env,
  content: string,
  name: string,
  updateInterval: string,
): Promise<ResinPushResult> {
  const storedId = (await env.STATE.get(KEYS.resinSubscriptionId, "text")) ?? "";
  const existing = await findSubscription(env, storedId, name);
  let subscription: ResinSubscription;
  let action: "created" | "updated";

  if (existing?.id) {
    if (existing.source_type && existing.source_type !== "local") {
      throw new Error(
        `Resin subscription ${existing.id} is ${existing.source_type}; source_type cannot be changed to local`,
      );
    }
    subscription = await resinRequest<ResinSubscription>(
      env,
      `/api/v1/subscriptions/${encodeURIComponent(existing.id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          name,
          content,
          update_interval: updateInterval,
          enabled: true,
          incremental_alive_nodes: true,
        }),
      },
    );
    action = "updated";
  } else {
    subscription = await resinRequest<ResinSubscription>(
      env,
      "/api/v1/subscriptions",
      {
        method: "POST",
        body: JSON.stringify({
          name,
          source_type: "local",
          content,
          update_interval: updateInterval,
          enabled: true,
          ephemeral: false,
          incremental_alive_nodes: true,
        }),
      },
      [201],
    );
    action = "created";
  }

  const subscriptionId = String(subscription.id ?? existing?.id ?? "");
  if (!subscriptionId) throw new Error("Resin response did not include a subscription id");
  await env.STATE.put(KEYS.resinSubscriptionId, subscriptionId);

  let refreshOk = true;
  try {
    await resinRequest<{ status?: string }>(
      env,
      `/api/v1/subscriptions/${encodeURIComponent(subscriptionId)}/actions/refresh`,
      { method: "POST", body: "{}" },
    );
  } catch (error) {
    refreshOk = false;
    const message = error instanceof Error ? error.message : String(error);
    console.warn("Resin subscription updated but refresh failed", { subscriptionId, error: message.slice(0, 300) });
  }

  return {
    action,
    subscriptionId,
    refreshOk,
    nodeCount: subscription.node_count,
  };
}
