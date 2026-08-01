import { describe, expect, it } from "vitest";

import {
  DEFAULT_SOURCE_IDS,
  PROXY_SOURCES,
  parseProxyText,
} from "../src/sources";
import type { ProxyProtocol } from "../src/types";

describe("parseProxyText", () => {
  it("validates, filters and deduplicates proxy lines", () => {
    const allowed = new Set<ProxyProtocol>(["http", "socks5"]);
    const records = parseProxyText(
      [
        "1.2.3.4:8080",
        "1.2.3.4:8080",
        "socks5://5.6.7.8:1080",
        "socks4://9.9.9.9:1080",
        "999.1.1.1:80",
        "1.1.1.1:99999",
      ].join("\n"),
      "test",
      undefined,
      allowed,
      100,
    );
    expect(records.map((item) => item.uri)).toEqual(["socks5://5.6.7.8:1080"]);
  });

  it("uses a source protocol for plain ip:port lists", () => {
    const records = parseProxyText(
      "1.2.3.4:8080\n5.6.7.8:3128",
      "plain-http",
      "http",
      new Set<ProxyProtocol>(["http"]),
      1,
    );
    expect(records).toHaveLength(1);
    expect(records[0]?.uri).toBe("http://1.2.3.4:8080");
  });
});

describe("proxy source catalog", () => {
  it("uses unique ids and keeps every default source available", () => {
    const ids = PROXY_SOURCES.map((source) => source.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(DEFAULT_SOURCE_IDS.every((id) => ids.includes(id))).toBe(true);
  });

  it("uses HTTPS for every public proxy source", () => {
    expect(PROXY_SOURCES.every((source) => source.url.startsWith("https://"))).toBe(true);
  });
});
