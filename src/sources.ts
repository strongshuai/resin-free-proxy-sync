import type {
  AppSettings,
  ProxyProtocol,
  ProxyRecord,
  ProxySource,
  SourceResult,
} from "./types";

const MAX_SOURCE_BYTES = 4 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;
const FETCH_CONCURRENCY = 4;

export const PROXY_SOURCES: readonly ProxySource[] = [
  {
    id: "proxifly",
    name: "Proxifly All",
    url: "https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list@main/proxies/all/data.json",
    kind: "proxifly",
  },
  {
    id: "databay_http",
    name: "Databay HTTP",
    url: "https://raw.githubusercontent.com/databay-labs/free-proxy-list/master/http.txt",
    kind: "plain",
    protocol: "http",
  },
  {
    id: "databay_socks5",
    name: "Databay SOCKS5",
    url: "https://raw.githubusercontent.com/databay-labs/free-proxy-list/master/socks5.txt",
    kind: "plain",
    protocol: "socks5",
  },
  {
    id: "iplocate_http",
    name: "IPLocate HTTP",
    url: "https://raw.githubusercontent.com/iplocate/free-proxy-list/main/protocols/http.txt",
    kind: "plain",
    protocol: "http",
  },
  {
    id: "iplocate_socks5",
    name: "IPLocate SOCKS5",
    url: "https://raw.githubusercontent.com/iplocate/free-proxy-list/main/protocols/socks5.txt",
    kind: "plain",
    protocol: "socks5",
  },
  {
    id: "roosterkid_http",
    name: "OpenProxyList HTTPS",
    url: "https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS.txt",
    kind: "plain",
    protocol: "http",
  },
  {
    id: "roosterkid_socks5",
    name: "OpenProxyList SOCKS5",
    url: "https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS5.txt",
    kind: "plain",
    protocol: "socks5",
  },
  {
    id: "thespeedx_http",
    name: "TheSpeedX HTTP",
    url: "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt",
    kind: "plain",
    protocol: "http",
  },
  {
    id: "thespeedx_socks5",
    name: "TheSpeedX SOCKS5",
    url: "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt",
    kind: "plain",
    protocol: "socks5",
  },
  {
    id: "monosans_http",
    name: "Monosans HTTP",
    url: "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt",
    kind: "plain",
    protocol: "http",
  },
  {
    id: "monosans_socks5",
    name: "Monosans SOCKS5",
    url: "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt",
    kind: "plain",
    protocol: "socks5",
  },
  {
    id: "sunny9577_http",
    name: "Sunny9577 HTTP",
    url: "https://raw.githubusercontent.com/sunny9577/proxy-scraper/master/generated/http_proxies.txt",
    kind: "plain",
    protocol: "http",
  },
  {
    id: "zaeem20_http",
    name: "Zaeem20 HTTP",
    url: "https://raw.githubusercontent.com/Zaeem20/FREE_PROXIES_LIST/master/http.txt",
    kind: "plain",
    protocol: "http",
  },
  {
    id: "zaeem20_socks5",
    name: "Zaeem20 SOCKS5",
    url: "https://raw.githubusercontent.com/Zaeem20/FREE_PROXIES_LIST/master/socks5.txt",
    kind: "plain",
    protocol: "socks5",
  },
  {
    id: "vpslab_http",
    name: "VPSLab HTTP",
    url: "https://raw.githubusercontent.com/VPSLabCloud/VPSLab-Free-Proxy-List/main/http_all.txt",
    kind: "plain",
    protocol: "http",
  },
  {
    id: "vpslab_socks5",
    name: "VPSLab SOCKS5",
    url: "https://raw.githubusercontent.com/VPSLabCloud/VPSLab-Free-Proxy-List/main/socks5_all.txt",
    kind: "plain",
    protocol: "socks5",
  },
  {
    id: "hookzof_socks5",
    name: "Hookzof SOCKS5",
    url: "https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt",
    kind: "plain",
    protocol: "socks5",
  },
  {
    id: "spysme_http",
    name: "Spys.me HTTP",
    url: "https://spys.me/proxy.txt",
    kind: "spysme",
    protocol: "http",
  },
  {
    id: "proxyscrape_http",
    name: "ProxyScrape HTTP",
    url: "https://api.proxyscrape.com/v4/free-proxy-list/get?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all",
    kind: "plain",
    protocol: "http",
  },
  {
    id: "proxyscrape_socks5",
    name: "ProxyScrape SOCKS5",
    url: "https://api.proxyscrape.com/v4/free-proxy-list/get?request=displayproxies&protocol=socks5&timeout=10000&country=all",
    kind: "plain",
    protocol: "socks5",
  },
  {
    id: "myproxy_http",
    name: "My-Proxy HTTP",
    url: "https://www.my-proxy.com/free-proxy-list.html",
    kind: "myproxy",
    protocol: "http",
  },
] as const;

export const DEFAULT_SOURCE_IDS = [
  "databay_http",
  "databay_socks5",
  "iplocate_http",
  "iplocate_socks5",
  "roosterkid_http",
  "roosterkid_socks5",
  "proxyscrape_http",
  "proxyscrape_socks5",
] as const;

export const SOURCE_BY_ID = new Map(PROXY_SOURCES.map((source) => [source.id, source]));

const PROXY_RE = /(?:(https?|socks4|socks5|socks5h):\/\/)?((?:\d{1,3}\.){3}\d{1,3}):(\d{1,5})/gi;

function validIpv4(value: string): boolean {
  const parts = value.split(".");
  return parts.length === 4 && parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const number = Number(part);
    return number >= 0 && number <= 255;
  });
}

function normalizeProtocol(value: string | undefined): ProxyProtocol | null {
  const protocol = String(value ?? "").toLowerCase();
  if (protocol === "http" || protocol === "https" || protocol === "socks5") {
    return protocol;
  }
  if (protocol === "socks5h") return "socks5";
  return null;
}

function createRecord(
  host: string,
  portText: string | number,
  protocolText: string | undefined,
  sourceId: string,
  country: string,
  allowedProtocols: ReadonlySet<ProxyProtocol>,
): ProxyRecord | null {
  const protocol = normalizeProtocol(protocolText);
  const port = Number(portText);
  if (!protocol || !allowedProtocols.has(protocol)) return null;
  if (!validIpv4(host) || !Number.isInteger(port) || port < 1 || port > 65_535) return null;
  return {
    uri: `${protocol}://${host}:${port}`,
    protocol,
    host,
    port,
    sourceId,
    country: String(country || "").trim().toUpperCase().slice(0, 8),
  };
}

export function parseProxyText(
  text: string,
  sourceId: string,
  forcedProtocol: ProxyProtocol | undefined,
  allowedProtocols: ReadonlySet<ProxyProtocol>,
  limit: number,
): ProxyRecord[] {
  const records: ProxyRecord[] = [];
  const seen = new Set<string>();
  PROXY_RE.lastIndex = 0;
  for (const match of text.matchAll(PROXY_RE)) {
    const record = createRecord(
      match[2] ?? "",
      match[3] ?? "",
      forcedProtocol ?? match[1],
      sourceId,
      "",
      allowedProtocols,
    );
    if (!record || seen.has(record.uri)) continue;
    seen.add(record.uri);
    records.push(record);
    if (records.length >= limit) break;
  }
  return records;
}

function parseProxifly(
  text: string,
  source: ProxySource,
  allowedProtocols: ReadonlySet<ProxyProtocol>,
  limit: number,
): ProxyRecord[] {
  const data: unknown = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error("invalid JSON list");
  const records: ProxyRecord[] = [];
  const seen = new Set<string>();
  for (const raw of data) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const proxyText = String(item.proxy ?? "");
    PROXY_RE.lastIndex = 0;
    const match = PROXY_RE.exec(proxyText);
    const geo = item.geolocation && typeof item.geolocation === "object"
      ? item.geolocation as Record<string, unknown>
      : {};
    const record = match
      ? createRecord(
          match[2] ?? "",
          match[3] ?? "",
          String(item.protocol ?? match[1] ?? ""),
          source.id,
          String(geo.country ?? ""),
          allowedProtocols,
        )
      : createRecord(
          String(item.ip ?? ""),
          String(item.port ?? ""),
          String(item.protocol ?? ""),
          source.id,
          String(geo.country ?? ""),
          allowedProtocols,
        );
    if (!record || seen.has(record.uri)) continue;
    seen.add(record.uri);
    records.push(record);
    if (records.length >= limit) break;
  }
  return records;
}

function parseSpysMe(
  text: string,
  source: ProxySource,
  allowedProtocols: ReadonlySet<ProxyProtocol>,
  limit: number,
): ProxyRecord[] {
  const records: ProxyRecord[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*((?:\d{1,3}\.){3}\d{1,3}):(\d{1,5})\s+([A-Z]{2})-/);
    if (!match) continue;
    const record = createRecord(
      match[1] ?? "",
      match[2] ?? "",
      source.protocol,
      source.id,
      match[3] ?? "",
      allowedProtocols,
    );
    if (!record || seen.has(record.uri)) continue;
    seen.add(record.uri);
    records.push(record);
    if (records.length >= limit) break;
  }
  return records;
}

function parseMyProxy(
  text: string,
  source: ProxySource,
  allowedProtocols: ReadonlySet<ProxyProtocol>,
  limit: number,
): ProxyRecord[] {
  const records: ProxyRecord[] = [];
  const seen = new Set<string>();
  const regex = /((?:\d{1,3}\.){3}\d{1,3}):(\d{1,5})#([A-Z]{2})/g;
  for (const match of text.matchAll(regex)) {
    const record = createRecord(
      match[1] ?? "",
      match[2] ?? "",
      source.protocol,
      source.id,
      match[3] ?? "",
      allowedProtocols,
    );
    if (!record || seen.has(record.uri)) continue;
    seen.add(record.uri);
    records.push(record);
    if (records.length >= limit) break;
  }
  return records;
}

async function readLimitedText(response: Response): Promise<string> {
  const headerLength = Number(response.headers.get("content-length") ?? 0);
  if (headerLength > MAX_SOURCE_BYTES) throw new Error("response is too large");
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    total += chunk.value.byteLength;
    if (total > MAX_SOURCE_BYTES) {
      await reader.cancel();
      throw new Error("response exceeded 4 MiB");
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  return text + decoder.decode();
}

async function fetchOneSource(
  source: ProxySource,
  settings: AppSettings,
  fetcher: typeof fetch,
): Promise<{ records: ProxyRecord[]; result: SourceResult }> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("source timeout"), FETCH_TIMEOUT_MS);
  try {
    const response = await fetcher(source.url, {
      headers: {
        Accept: "text/plain, application/json;q=0.9, */*;q=0.5",
        "User-Agent": "resin-free-proxy-sync/1.0",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await readLimitedText(response);
    const allowed = new Set(settings.protocols);
    let records: ProxyRecord[];
    switch (source.kind) {
      case "proxifly":
        records = parseProxifly(text, source, allowed, settings.perSourceLimit);
        break;
      case "spysme":
        records = parseSpysMe(text, source, allowed, settings.perSourceLimit);
        break;
      case "myproxy":
        records = parseMyProxy(text, source, allowed, settings.perSourceLimit);
        break;
      default:
        records = parseProxyText(
          text,
          source.id,
          source.protocol,
          allowed,
          settings.perSourceLimit,
        );
    }
    return {
      records,
      result: {
        id: source.id,
        name: source.name,
        count: records.length,
        elapsedMs: Date.now() - started,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      records: [],
      result: {
        id: source.id,
        name: source.name,
        count: 0,
        elapsedMs: Date.now() - started,
        error: message.slice(0, 240),
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchSelectedSources(
  settings: AppSettings,
  fetcher: typeof fetch = fetch,
): Promise<{ proxies: ProxyRecord[]; sourceResults: SourceResult[] }> {
  const selected = settings.sourceIds
    .map((id) => SOURCE_BY_ID.get(id))
    .filter((source): source is ProxySource => Boolean(source));
  const allRecords: ProxyRecord[] = [];
  const sourceResults: SourceResult[] = [];

  for (let offset = 0; offset < selected.length; offset += FETCH_CONCURRENCY) {
    const batch = selected.slice(offset, offset + FETCH_CONCURRENCY);
    const results = await Promise.all(batch.map((source) => fetchOneSource(source, settings, fetcher)));
    for (const result of results) {
      allRecords.push(...result.records);
      sourceResults.push(result.result);
    }
  }

  const unique = new Map<string, ProxyRecord>();
  for (const record of allRecords) {
    if (!unique.has(record.uri)) unique.set(record.uri, record);
  }
  const proxies = [...unique.values()].sort((a, b) => a.uri.localeCompare(b.uri));
  return { proxies, sourceResults };
}
