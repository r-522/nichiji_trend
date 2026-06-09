/**
 * Thin npm-registry client used only in --online mode.
 *
 * Uses the global fetch (Node >= 20) and degrades gracefully: any network
 * error is reported as "unknown" rather than throwing, so a scan never fails
 * just because the registry is unreachable.
 */
import type { RegistryFacts } from "./types.js";

const REGISTRY = "https://registry.npmjs.org";
const DOWNLOADS_API = "https://api.npmjs.org/downloads/point/last-week";

async function fetchJson(url: string, timeoutMs: number): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: "application/json" },
    });
    if (res.status === 404) return { __notFound: true };
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Look up registry facts for a single package. Returns `exists: true` with
 * `undefined` enrichment fields when the network is flaky, so heuristics can
 * still distinguish "definitely missing" from "couldn't tell".
 */
export async function getRegistryFacts(
  name: string,
  timeoutMs = 8000,
): Promise<RegistryFacts> {
  const meta = await fetchJson(`${REGISTRY}/${encodeURIComponent(name).replace("%40", "@")}`, timeoutMs);

  if (meta && typeof meta === "object" && "__notFound" in meta) {
    return { exists: false };
  }
  if (!meta || typeof meta !== "object") {
    // Network failure: assume it exists to avoid false "phantom" alarms.
    return { exists: true };
  }

  const m = meta as Record<string, any>;
  const createdAt: string | undefined = m.time?.created;
  const latestVersion: string | undefined = m["dist-tags"]?.latest;
  const latest = latestVersion ? m.versions?.[latestVersion] : undefined;
  const scripts: Record<string, string> = latest?.scripts ?? {};
  const hasInstallScript = ["preinstall", "install", "postinstall"].some(
    (k) => typeof scripts[k] === "string" && scripts[k].length > 0,
  );

  let weeklyDownloads: number | undefined;
  const dl = await fetchJson(`${DOWNLOADS_API}/${encodeURIComponent(name).replace("%40", "@")}`, timeoutMs);
  if (dl && typeof dl === "object" && typeof (dl as any).downloads === "number") {
    weeklyDownloads = (dl as any).downloads;
  }

  return { exists: true, createdAt, weeklyDownloads, hasInstallScript };
}
