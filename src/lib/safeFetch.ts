/**
 * Same guarantee as `req()` in `client.ts`, for the handful of unauthenticated
 * `fetch(...).then(r => r.json())` calls scattered across the marketing/guide
 * pages (stats banners, health probes). Never throws a raw `SyntaxError` from a
 * non-JSON body (HTML error page, empty response, network failure) — callers get
 * `null` instead and can render a "relay unreachable" state.
 */
export async function safeJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store", ...init });
    const text = await res.text().catch(() => "");
    if (!text || !/^\s*[[{]/.test(text)) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
