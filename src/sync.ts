import {
  KEYS,
  loadRuntime,
  loadSettings,
  saveRuntime,
  saveSnapshot,
} from "./config";
import { buildSubscriptionContent, upsertResinSubscription } from "./resin";
import { fetchSelectedSources } from "./sources";
import type {
  AppSettings,
  Env,
  ProxySnapshot,
  RunReason,
  RunSummary,
  RuntimeState,
} from "./types";

const LOCK_TTL_SECONDS = 15 * 60;

interface RunLock {
  runId: string;
  expiresAt: number;
}

interface PreparedRun {
  accepted: boolean;
  runId?: string;
  task?: Promise<void>;
  message?: string;
}

function newRunId(reason: RunReason): string {
  return `${reason}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

async function loadLock(env: Env): Promise<RunLock | null> {
  const raw = await env.STATE.get(KEYS.lock, "text");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RunLock;
  } catch {
    return null;
  }
}

async function releaseLock(env: Env, runId: string): Promise<void> {
  const lock = await loadLock(env);
  if (lock?.runId === runId) await env.STATE.delete(KEYS.lock);
}

function createSnapshot(records: Awaited<ReturnType<typeof fetchSelectedSources>>["proxies"]): ProxySnapshot {
  const sourceCounts: Record<string, number> = {};
  const protocolCounts: Record<string, number> = {};
  for (const record of records) {
    sourceCounts[record.sourceId] = (sourceCounts[record.sourceId] ?? 0) + 1;
    protocolCounts[record.protocol] = (protocolCounts[record.protocol] ?? 0) + 1;
  }
  return {
    generatedAt: new Date().toISOString(),
    count: records.length,
    lines: records.map((record) => record.uri),
    sourceCounts,
    protocolCounts,
  };
}

async function updateStage(env: Env, runId: string, stage: RuntimeState["stage"]): Promise<void> {
  const runtime = await loadRuntime(env);
  if (runtime.runId !== runId) return;
  runtime.stage = stage;
  await saveRuntime(env, runtime);
}

async function executeRun(
  env: Env,
  settings: AppSettings,
  runId: string,
  reason: RunReason,
  startedAtMs: number,
): Promise<void> {
  let proxyCount = 0;
  let sourceResults: RunSummary["sourceResults"] = [];
  try {
    await updateStage(env, runId, "fetching");
    const fetched = await fetchSelectedSources(settings);
    sourceResults = fetched.sourceResults;
    proxyCount = fetched.proxies.length;
    if (proxyCount === 0) {
      const details = sourceResults
        .filter((item) => item.error)
        .slice(0, 4)
        .map((item) => `${item.id}: ${item.error}`)
        .join("; ");
      throw new Error(`no usable proxies were fetched${details ? ` (${details})` : ""}`);
    }

    await updateStage(env, runId, "saving");
    const snapshot = createSnapshot(fetched.proxies);
    await saveSnapshot(env, snapshot);

    await updateStage(env, runId, "pushing");
    const content = buildSubscriptionContent(fetched.proxies, new Date(snapshot.generatedAt));
    const resin = await upsertResinSubscription(
      env,
      content,
      settings.resinSubscriptionName,
      settings.resinUpdateInterval,
    );

    const finishedAtMs = Date.now();
    const summary: RunSummary = {
      runId,
      reason,
      status: "completed",
      startedAt: new Date(startedAtMs).toISOString(),
      finishedAt: new Date(finishedAtMs).toISOString(),
      durationMs: finishedAtMs - startedAtMs,
      proxyCount,
      sourceResults,
      resin,
    };
    const runtime = await loadRuntime(env);
    await saveRuntime(env, {
      ...runtime,
      running: false,
      stage: "completed",
      lastResult: summary,
      history: [summary, ...runtime.history.filter((item) => item.runId !== runId)].slice(0, 20),
    });
    console.log("Free proxy sync completed", {
      runId,
      reason,
      proxyCount,
      resinAction: resin.action,
      resinSubscriptionId: resin.subscriptionId,
      refreshOk: resin.refreshOk,
    });
  } catch (error) {
    const finishedAtMs = Date.now();
    const message = error instanceof Error ? error.message : String(error);
    const summary: RunSummary = {
      runId,
      reason,
      status: "failed",
      startedAt: new Date(startedAtMs).toISOString(),
      finishedAt: new Date(finishedAtMs).toISOString(),
      durationMs: finishedAtMs - startedAtMs,
      proxyCount,
      sourceResults,
      error: message.slice(0, 800),
    };
    const runtime = await loadRuntime(env);
    await saveRuntime(env, {
      ...runtime,
      running: false,
      stage: "failed",
      lastResult: summary,
      history: [summary, ...runtime.history.filter((item) => item.runId !== runId)].slice(0, 20),
    });
    console.error("Free proxy sync failed", { runId, reason, error: message.slice(0, 500) });
  } finally {
    await releaseLock(env, runId);
  }
}

export async function prepareRun(
  env: Env,
  reason: RunReason,
  scheduledDate?: string,
): Promise<PreparedRun> {
  const now = Date.now();
  const lock = await loadLock(env);
  if (lock && lock.expiresAt > now) {
    return { accepted: false, message: `run already active: ${lock.runId}` };
  }

  const settings = await loadSettings(env);
  const runId = newRunId(reason);
  const newLock: RunLock = { runId, expiresAt: now + LOCK_TTL_SECONDS * 1_000 };
  await env.STATE.put(KEYS.lock, JSON.stringify(newLock), { expirationTtl: LOCK_TTL_SECONDS });

  const runtime = await loadRuntime(env);
  await saveRuntime(env, {
    ...runtime,
    running: true,
    runId,
    reason,
    stage: "fetching",
    startedAt: new Date(now).toISOString(),
    lastScheduledDate: scheduledDate ?? runtime.lastScheduledDate,
  });

  return {
    accepted: true,
    runId,
    task: executeRun(env, settings, runId, reason, now),
  };
}
