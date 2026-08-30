# Security Headers Checklist

Run after every deployment:

```bash
HOST=https://your-host.example
curl -sSI "$HOST" | tr -d '\r' | grep -Ei \
  'content-security-policy|strict-transport-security|x-content-type-options|x-frame-options|referrer-policy|permissions-policy|cross-origin'
```

| Header | Required value / intent | Where configured |
| --- | --- | --- |
| `Content-Security-Policy` | `default-src 'self'`; no `eval`; no object/embed; `frame-ancestors 'none'`; only own API connects | `layout.tsx`, `vercel.json`, `netlify.toml`, `public/_headers` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` (production HTTPS only) | host configs / reverse proxy |
| `X-Content-Type-Options` | `nosniff` | all relay responses + host configs |
| `X-Frame-Options` | `DENY` | all relay responses + host configs |
| `Referrer-Policy` | `no-referrer` | all relay responses + document meta |
| `Permissions-Policy` | camera/mic/geolocation/browsing-topics disabled until a feature explicitly needs one | host configs |
| `Cross-Origin-Opener-Policy` | `same-origin` | all responses |
| `Cross-Origin-Resource-Policy` | `same-origin` | static host configs |
| `Cache-Control` | API: `no-store, private`; immutable hashed static assets may cache | relay router / host |

## CSP notes

- The current app has no `dangerouslySetInnerHTML` for user content and no `eval`.
- Next's runtime requires inline bootstrapping in this build, hence `'unsafe-inline'` is currently present for scripts/styles. Removing it requires framework-generated CSP nonces wired through middleware. Treat that as a tracked hardening item, not as “done”.
- Fonts are local system fonts; no font CDN is allowlisted. `font-src` is restricted to self/data only.
- Do not enable COEP `require-corp` until attachment downloads and cross-origin isolation is tested; an incorrect COEP breaks blob previews.
- **Screenshot / watermark notes:** `style-src` must allow the same-origin `globals.css` that carries `.no-screenshot { user-select:none; -webkit-touch-callout:none }` and `.watermark { repeating-linear-gradient }` — these are pure CSS, no `img-src` needed. Do not add `allow-popups` or loosen `frame-ancestors` (stays `'none'`) — the watermark + `X-Frame-Options: DENY` + `frame-ancestors 'none'` together deter drag-out and framing capture.

## Extreme-privacy headers & client friction (post 9c95ee7)

For defence-in-depth beyond headers:

- **Headers remain strict:** `default-src 'self'`; no `eval`; `object-src 'none'`; `frame-ancestors 'none'`; `COOP: same-origin`. API: `Cache-Control: no-store, private`.
- **Client friction (not a header but documented here for verify):** `src/app/page.tsx:174` blocks `copy` outside inputs, `contextmenu` prevented, `PrintScreen`/`Ctrl+P`/`Ctrl+Shift+S` intercepted with a toast, `visibilitychange`/`blur` applies `filter: blur(7px)` via `.secret`. Validate after deploy with `curl -SI` + manual `PrintScreen` test (expect toast + `secret` class while unfocused, and watermark `repeating-linear-gradient` at 4% opacity).
- **Honesty:** OS-level screenshot cannot be blocked 100% (camera, VM, hardware capture). The control is **friction + watermark + blur-after-download**; the ledger still records `msg.shredded`/`message.burned` content-free. This matches `THREAT-MODEL.md` > Screenshot / download friction.

## External verification

1. `curl` as above (source of truth for API and every page).
2. Run a scan at securityheaders.com against the production hostname.
3. Browser DevTools → Network → document → Response Headers.
4. Deliberate framing test from another origin must fail.
5. `/api/ked/__crash-test` must still return JSON with the same headers, never an HTML framework page.
