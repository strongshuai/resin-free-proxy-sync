import { afterEach, describe, expect, it, vi } from "vitest";

import { buildSubscriptionContent, normalizeResinApiBase, upsertResinSubscription } from "../src/resin";
import type { Env, KVNamespace } from "../src/types";

class MemoryKV implements KVNamespace {
  private readonly values = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildSubscriptionContent", () => {
  it("emits Resin-compatible proxy URI lines", () => {
    const text = buildSubscriptionContent(
      [
        { uri: "http://1.2.3.4:8080", protocol: "http", host: "1.2.3.4", port: 8080, sourceId: "a", country: "" },
        { uri: "socks5://5.6.7.8:1080", protocol: "socks5", host: "5.6.7.8", port: 1080, sourceId: "b", country: "" },
      ],
      new Date("2026-08-01T00:00:00.000Z"),
    );
    expect(text).toContain("# count=2");
    expect(text).toContain("http://1.2.3.4:8080");
    expect(text).toContain("socks5://5.6.7.8:1080");
  });

  it("routes bare HTTP IPv4 Resin addresses through sslip.io", () => {
    expect(normalizeResinApiBase("http://203.0.113.10:2260/")).toBe(
      "http://203-0-113-10.sslip.io:2260",
    );
    expect(normalizeResinApiBase("https://resin.example.com/")).toBe("https://resin.example.com");
  });

  it("creates once and patches the same Resin subscription later", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    let created = false;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ url, method });
      if (method === "GET" && url.endsWith("/api/v1/subscriptions/sub-1")) {
        return Response.json({ id: "sub-1", name: "Free-Proxies", source_type: "local" });
      }
      if (method === "GET") return Response.json({ items: [] });
      if (method === "POST" && url.endsWith("/api/v1/subscriptions")) {
        created = true;
        return Response.json({ id: "sub-1", source_type: "local" }, { status: 201 });
      }
      if (method === "PATCH") return Response.json({ id: "sub-1", source_type: "local" });
      if (method === "POST" && url.endsWith("/actions/refresh")) {
        return Response.json({ status: "ok" });
      }
      return new Response("unexpected", { status: 500 });
    }));

    const env: Env = {
      STATE: new MemoryKV(),
      RESIN_API_BASE: "https://resin.example.com",
      RESIN_ADMIN_TOKEN: "secret",
    };
    const first = await upsertResinSubscription(env, "http://1.2.3.4:8080\n", "Free-Proxies", "1h");
    const second = await upsertResinSubscription(env, "http://5.6.7.8:3128\n", "Free-Proxies", "1h");

    expect(created).toBe(true);
    expect(first.action).toBe("created");
    expect(second.action).toBe("updated");
    expect(calls.some((call) => call.method === "PATCH")).toBe(true);
    expect(calls.filter((call) => call.url.endsWith("/actions/refresh"))).toHaveLength(2);
  });
});
