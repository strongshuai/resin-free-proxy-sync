import { isAdminAuthorized, secureEqual } from "./auth";
import {
  loadRuntime,
  loadSettings,
  loadSnapshot,
  saveSettings,
  shouldRunScheduled,
} from "./config";
import { PROXY_SOURCES } from "./sources";
import { prepareRun } from "./sync";
import type { Env, ExecutionContext, ScheduledController } from "./types";
import { ADMIN_HTML } from "./ui";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function environmentStatus(env: Env): { ready: boolean; missing: string[] } {
  const required: Array<[string, string | undefined]> = [
    ["ADMIN_TOKEN", env.ADMIN_TOKEN],
    ["RESIN_API_BASE", env.RESIN_API_BASE],
    ["RESIN_ADMIN_TOKEN", env.RESIN_ADMIN_TOKEN],
  ];
  const missing = required
    .filter(([, value]) => !String(value ?? "").trim())
    .map(([name]) => name);
  return { ready: missing.length === 0, missing };
}

async function statusResponse(env: Env, request: Request): Promise<Response> {
  const [settings, state, snapshot] = await Promise.all([
    loadSettings(env),
    loadRuntime(env),
    loadSnapshot(env),
  ]);
  const origin = new URL(request.url).origin;
  return json({
    ok: true,
    settings,
    state,
    snapshot: snapshot
      ? { generatedAt: snapshot.generatedAt, count: snapshot.count, sourceCounts: snapshot.sourceCounts, protocolCounts: snapshot.protocolCounts }
      : null,
    sources: PROXY_SOURCES,
    environment: environmentStatus(env),
    feedUrl: env.FEED_TOKEN ? `${origin}/feed/${encodeURIComponent(env.FEED_TOKEN)}` : "",
  });
}

async function handleApi(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (!(await isAdminAuthorized(request, env))) return json({ error: "unauthorized" }, 401);
  const url = new URL(request.url);

  if (url.pathname === "/api/status" && request.method === "GET") {
    return statusResponse(env, request);
  }
  if (url.pathname === "/api/settings" && (request.method === "PUT" || request.method === "POST")) {
    const body = await request.json() as Record<string, unknown>;
    const settings = await saveSettings(env, body);
    return json({ ok: true, settings });
  }
  if (url.pathname === "/api/run" && request.method === "POST") {
    const environment = environmentStatus(env);
    if (!environment.ready) return json({ error: `missing environment: ${environment.missing.join(", ")}` }, 503);
    const prepared = await prepareRun(env, "manual");
    if (!prepared.accepted || !prepared.task) return json({ error: prepared.message ?? "run rejected" }, 409);
    ctx.waitUntil(prepared.task);
    return json({ ok: true, accepted: true, runId: prepared.runId }, 202);
  }
  return json({ error: "not found" }, 404);
}

async function handleFeed(request: Request, env: Env): Promise<Response> {
  const expected = String(env.FEED_TOKEN ?? "").trim();
  const provided = decodeURIComponent(new URL(request.url).pathname.slice("/feed/".length));
  if (!expected || !(await secureEqual(provided, expected))) return new Response("not found", { status: 404 });
  const snapshot = await loadSnapshot(env);
  if (!snapshot) return new Response("# no snapshot yet\n", { status: 503 });
  return new Response(
    [`# resin-free-proxy-sync generated=${snapshot.generatedAt}`, `# count=${snapshot.count}`, ...snapshot.lines, ""].join("\n"),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Proxy-Count": String(snapshot.count),
      },
    },
  );
}

async function fetchHandler(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  try {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      return new Response(ADMIN_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    if (url.pathname === "/health") {
      return json({ ok: true, service: "resin-free-proxy-sync", environment: environmentStatus(env) });
    }
    if (url.pathname.startsWith("/feed/") && request.method === "GET") {
      return handleFeed(request, env);
    }
    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, ctx);
    }
    return new Response("not found", { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Request failed", { path: new URL(request.url).pathname, error: message.slice(0, 500) });
    return json({ error: message.slice(0, 800) }, 400);
  }
}

async function scheduledHandler(
  controller: ScheduledController,
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  const environment = environmentStatus(env);
  if (!environment.ready) {
    console.warn("Scheduled sync skipped: missing environment", { missing: environment.missing });
    return;
  }
  const [settings, runtime] = await Promise.all([loadSettings(env), loadRuntime(env)]);
  const due = shouldRunScheduled(new Date(controller.scheduledTime || Date.now()), settings, runtime.lastScheduledDate);
  if (!due.due) return;
  const prepared = await prepareRun(env, "schedule", due.scheduledDate);
  if (prepared.accepted && prepared.task) ctx.waitUntil(prepared.task);
}

export default {
  fetch: fetchHandler,
  scheduled: scheduledHandler,
};
