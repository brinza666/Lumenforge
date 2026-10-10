export type WledInfo = {
  ver?: string;
  name?: string;
  arch?: string;
  brand?: string;
  product?: string;
  mac?: string;
  fxcount?: number;
  palcount?: number;
  leds?: { count?: number; fps?: number; maxpwr?: number; pwr?: number };
  live?: boolean;
};

export type WledNode = {
  name?: string;
  ip?: string;
  type?: number;
  vid?: number;
  age?: number;
};

export type LampSnapshot = {
  origin: string;
  info: WledInfo;
  effects: string[];
  palettes: string[];
  fxdata: string[];
  presets: Record<string, unknown> | null;
  nodes: WledNode[];
  state: Record<string, unknown> | null;
};

export class LampError extends Error {
  constructor(
    message: string,
    readonly kind: "blocked" | "unreachable" | "http" | "bad",
  ) {
    super(message);
    this.name = "LampError";
  }
}

export function pageIsSecure(): boolean {
  return typeof location !== "undefined" && location.protocol === "https:";
}

export function normalizeOrigin(input: string): string {
  let s = input.trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
  try {
    const url = new URL(s);
    if (!url.hostname) return "";
    return url.origin;
  } catch {
    return "";
  }
}

export function blockedMessage(): string {
  return "This page is https, and the lamp speaks plain http on your Wi-Fi. Phones usually refuse that mix. Design, playlists, and the firmware download still work. On desktop Chrome or Edge, allow local network access for this site and try again.";
}

function authHeader(user: string, password: string): string | undefined {
  if (!password) return undefined;
  const token = btoa(`${user || "wled"}:${password}`);
  return `Basic ${token}`;
}

async function request(
  url: string,
  ms: number,
  header: string | undefined,
  init?: RequestInit,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const headers = new Headers(init?.headers);
    if (header) headers.set("Authorization", header);
    return await fetch(url, { ...init, headers, signal: ctrl.signal });
  } catch (err) {
    const secure = pageIsSecure() && url.startsWith("http://");
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new LampError("The lamp did not answer in time.", "unreachable");
    }
    throw new LampError(secure ? blockedMessage() : "Could not reach that address.", secure ? "blocked" : "unreachable");
  } finally {
    clearTimeout(timer);
  }
}

async function getJson<T>(url: string, ms: number, header?: string): Promise<T> {
  const res = await request(url, ms, header);
  if (!res.ok) throw new LampError(`The lamp answered ${res.status}.`, "http");
  try {
    return (await res.json()) as T;
  } catch {
    throw new LampError("The lamp did not return JSON.", "bad");
  }
}

async function tryJson<T>(url: string, ms: number, header?: string): Promise<T | null> {
  try {
    return await getJson<T>(url, ms, header);
  } catch (err) {
    if (err instanceof LampError && (err.kind === "blocked" || err.kind === "unreachable")) throw err;
    return null;
  }
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

export async function loadLamp(origin: string, user: string, password: string): Promise<LampSnapshot> {
  const header = authHeader(user, password);
  const info = await getJson<WledInfo>(`${origin}/json/info`, 4500, header);
  if (!info || typeof info !== "object") throw new LampError("That address is not a WLED lamp.", "bad");
  const [effects, palettes, fxdata, presets, nodesWrap, state] = await Promise.all([
    tryJson<unknown>(`${origin}/json/effects`, 4000, header).then(async (v) => v ?? tryJson(`${origin}/json/eff`, 3000, header)),
    tryJson<unknown>(`${origin}/json/palettes`, 4000, header).then(async (v) => v ?? tryJson(`${origin}/json/pal`, 3000, header)),
    tryJson<unknown>(`${origin}/json/fxdata`, 3000, header),
    tryJson<Record<string, unknown>>(`${origin}/presets.json`, 4000, header),
    tryJson<{ nodes?: WledNode[] }>(`${origin}/json/nodes`, 3000, header),
    tryJson<Record<string, unknown>>(`${origin}/json/state`, 3000, header),
  ]);
  return {
    origin,
    info,
    effects: asStringArray(effects),
    palettes: asStringArray(palettes),
    fxdata: asStringArray(fxdata),
    presets: presets && typeof presets === "object" ? presets : null,
    nodes: Array.isArray(nodesWrap?.nodes) ? nodesWrap.nodes : [],
    state,
  };
}

export async function postState(origin: string, body: unknown, user: string, password: string): Promise<void> {
  const header = authHeader(user, password);
  const res = await request(`${origin}/json/state`, 6000, header, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new LampError(`The lamp refused the update (${res.status}).`, "http");
}

export function subnetPrefix(originOrIp: string): string | null {
  return parseSubnet(originOrIp);
}

/** First three octets of a private IPv4 address, or a prefix typed as `192.168.178`. */
export function parseSubnet(input: string): string | null {
  let raw = input.trim();
  if (!raw) return null;
  raw = raw.replace(/^https?:\/\//i, "");
  raw = raw.split("/")[0]?.split(":")[0] ?? raw;
  const match = raw.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?:\.(\d{1,3}))?$/);
  if (!match) return null;
  const octets = [match[1], match[2], match[3]].map((part) => Number(part));
  if (octets.some((n) => !Number.isInteger(n) || n > 255)) return null;
  if (match[4] !== undefined && Number(match[4]) > 255) return null;
  return octets.join(".");
}

export const COMMON_SUBNETS = ["192.168.0", "192.168.1", "192.168.2", "192.168.178", "10.0.0", "10.0.1"] as const;

function isPrivateIPv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

/** Best-effort LAN prefix from the browser. Many browsers hide this and return null. */
export function detectLanPrefix(timeoutMs = 1200): Promise<string | null> {
  if (typeof RTCPeerConnection === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const pc = new RTCPeerConnection({ iceServers: [] });
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      try {
        pc.close();
      } catch {
        /* already closed */
      }
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(null), timeoutMs);
    try {
      pc.createDataChannel("lan");
      pc.onicecandidate = (event) => {
        const cand = event.candidate?.candidate ?? "";
        const found = cand.match(/(\d{1,3}(?:\.\d{1,3}){3})/);
        if (!found) return;
        const ip = found[1];
        if (!ip || ip.startsWith("127.") || ip.startsWith("169.254.") || !isPrivateIPv4(ip)) return;
        const prefix = parseSubnet(ip);
        if (prefix) finish(prefix);
      };
      void pc
        .createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => finish(null));
    } catch {
      finish(null);
    }
  });
}

export async function probeHost(origin: string, user: string, password: string): Promise<WledInfo | null> {
  try {
    const info = await getJson<WledInfo>(`${origin}/json/info`, 900, authHeader(user, password));
    if (info && (info.name || info.ver || info.leds)) return info;
    return null;
  } catch {
    return null;
  }
}
