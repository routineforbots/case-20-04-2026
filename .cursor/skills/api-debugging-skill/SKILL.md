---
name: api-debugging
description: >-
  Systematic API testing, HTTP debugging, and failure triangulation (auth,
  CORS, validation, timeouts, webhooks). Use when debugging REST/GraphQL APIs,
  failing requests, status codes, integration tests, curl/fetch issues, proxy
  capture, or when the user asks to test or trace an API.
---

# API testing and debugging

This skill guides a methodical approach to **reproducing**, **isolating**, and **fixing** API issues. Prefer evidence (status line, headers, body, logs, timings) over guesses.

## When to apply

- Requests fail intermittently or always (4xx/5xx, network errors, timeouts).
- “It works in Postman but not in the app” (or the reverse).
- CORS, auth (401/403), CSRF, cookie, or redirect problems.
- Webhooks not firing or signature verification failing.
- Writing or fixing API integration tests and contract checks.

## Core principles

1. **Separate layers**: DNS/TLS → TCP connection → HTTP request/response → application logic → persistence. Narrow which layer fails first.
2. **Same inputs, minimal surface**: Reproduce with the smallest call (often `curl`) before debugging app code.
3. **Compare good vs bad**: Same endpoint, two environments or two clients; diff headers, body, and clock/skew.
4. **Never log or paste secrets**: Tokens, API keys, `Authorization` headers, cookies, webhook signing secrets. Redact in examples.

---

## Quick triage (order matters)

| Signal | Likely area |
|--------|-------------|
| DNS / connection refused / timeout | Network, firewall, wrong host/port, service down |
| TLS / certificate errors | HTTPS config, proxy, clock skew |
| **CORS** errors in browser only | Browser security; server `Access-Control-*`; often OK in curl |
| **401** | Missing/wrong/expired credentials, wrong scheme (Bearer vs Basic), clock skew (JWT) |
| **403** | Authorized identity but forbidden (RBAC, scope, IP allowlist) |
| **404** | Wrong path, method, API version, or routing |
| **409 / 422** | Validation, conflict, business rules |
| **429** | Rate limiting; check `Retry-After` |
| **5xx** | Server bug, overload, dependency timeout; need server logs/trace id |

Always note: **HTTP method**, **full URL** (including trailing slash and query string), **request headers** (especially `Content-Type`, `Accept`, `Authorization`), and **response status + body**.

---

## HTTP essentials for debugging

### Methods and idempotency

- **GET**: safe, idempotent; no body in many clients; caches may apply.
- **POST**: creates or non-idempotent actions; bodies usually JSON or form.
- **PUT** / **PATCH**: updates; know whether the API expects full or partial representation.
- **DELETE**: idempotent semantics vary; some APIs return 204 with empty body.

Wrong method often yields **405 Method Not Allowed** (check `Allow` header if present).

### Status codes (interpret, don’t memorize all)

- **2xx**: success; **201** often includes `Location`; **204** often no body.
- **3xx**: redirects; clients may drop or change method unless configured; auth cookies may be lost across domains.
- **4xx**: client or request error; body often has structured errors (JSON problem details, custom codes).
- **5xx**: server error; retry may be safe only if idempotent and documented.

### Headers that commonly cause bugs

- **`Content-Type`**: mismatch (`application/json` vs `text/plain`, missing charset).
- **`Accept`**: server returns 406 or unexpected format if strict.
- **`Authorization`**: scheme and token format; extra whitespace; expired JWT.
- **Cookies**: `SameSite`, `Secure`, `Domain`, path; missing on cross-site XHR/fetch.
- **Idempotency-Key**: duplicate submission protection for POST in payment-style APIs.
- **User-Agent / custom headers**: some gateways or WAFs block unknown agents.

### Bodies and serialization

- Validate JSON with a linter; watch for **trailing commas**, **NaN/Infinity** (invalid in JSON), **Date** serialization, **bigint**, **undefined** omitted vs null.
- Form encoding: `application/x-www-form-urlencoded` vs `multipart/form-data` (file uploads).
- Unicode and encoding: wrong charset garbles signatures (webhooks, HMAC over raw body).

---

## Reproduction workflow

1. **Freeze the contract**: method, URL, headers (names only if sensitive), body schema, expected status.
2. **Minimal `curl`** (or HTTPie) from the same machine as the app when possible:

```bash
curl -sS -i -X POST 'https://api.example.com/v1/items' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer REDACTED' \
  --data '{"name":"test"}'
```

- `-i` shows response headers; `-v` adds TLS and connection detail when needed.

3. **If curl works but browser fails**: suspect CORS, cookies, mixed content (HTTP vs HTTPS), or different headers.
4. **If browser works but server integration fails**: suspect env vars, network egress, TLS trust store, or different base URL.

---

## CORS (browser-only failures)

Symptoms: console errors mentioning CORS; network tab shows preflight **OPTIONS** failing or missing headers.

Checks:

- Preflight **OPTIONS** returns **2xx** for that route.
- Response includes appropriate **`Access-Control-Allow-Origin`** (not always `*` when credentials are used).
- If credentials/cookies: **`Access-Control-Allow-Credentials: true`** and specific origin (not `*`).
- Allowed methods and headers include what the client sends (`Authorization`, custom headers).

Server-side fix is required; client code cannot “disable” CORS for third-party APIs.

---

## Authentication debugging

- **API keys**: header vs query param; wrong environment (staging key on prod).
- **OAuth2**: token expiry, refresh flow, clock skew, wrong `aud`/`iss`, scope.
- **JWT**: validate structure locally only with safe tools; prefer server logs for signature failures.
- **mTLS**: client cert missing or wrong chain in service-to-service calls.
- **Session cookies**: path/domain; `SameSite=Lax` blocking cross-site POST; secure cookie on HTTP dev.

---

## Timeouts, retries, and rate limits

- Distinguish **connect** vs **read** timeout; load balancers often have lower idle timeouts than app servers.
- **429**: honor **`Retry-After`**; implement exponential backoff with jitter; avoid retry storms.
- **502/503/504**: often gateway or upstream; correlate with upstream health and latency.

---

## Webhooks

- **Delivery**: verify HTTP status your endpoint returns; many providers retry on non-2xx.
- **Signature**: compute HMAC over **raw body** as received; do not parse/re-stringify JSON before verify.
- **Ordering**: deliveries may arrive out of order; design idempotent handlers.
- **Local development**: use a tunnel (e.g. ngrok, Cloudflare Tunnel) with a stable URL if the provider allowlists URLs.

---

## GraphQL-specific

- Distinguish HTTP **200** with `errors` array vs real HTTP errors.
- Check **query cost**, depth limits, and persisted queries if enabled.
- Variables must match declared types; null vs omitted field semantics.

---

## Testing strategy (agent-assisted)

1. **Contract**: document or infer request/response shapes; note required fields and error envelope.
2. **Happy path**: one successful call per critical operation.
3. **Negative cases**: missing auth, malformed body, wrong type, not found, conflict.
4. **Idempotency**: repeat POST with same idempotency key where applicable.
5. **Performance**: optional latency percentiles under load; not always in scope for unit tests.

Prefer automated checks (integration tests, contract tests, schemathesis-style fuzzing) when the repo already has patterns; match existing test runners and style.

---

## Tools (pick what fits the repo)

| Tool | Use |
|------|-----|
| **curl** / **HTTPie** | Scriptable, minimal reproduction |
| **Browser DevTools** | Network tab, initiator chain, CORS, cookies |
| **mitmproxy / Charles** | TLS MITM for local debugging (install trust carefully) |
| **openssl s_client** | TLS/cert chain inspection |
| **dig / nslookup** | DNS |
| **jq** | Parse JSON logs/responses in terminal |

---

## Logging and correlation

- Prefer **correlation/request IDs**: propagate from client (header) or gateway into app and DB logs.
- Log **route, status, duration**, not raw tokens; log **error codes** from upstream in structured form.
- For distributed systems, trace across services (OpenTelemetry) when available.

---

## Agent behavior checklist

When helping debug an API:

1. Ask for or infer: **environment** (local/staging/prod), **exact URL**, **method**, **auth type**, and **error message or status** (without secrets).
2. Suggest a **minimal reproduction** and what to compare (two clients or two envs).
3. Map the failure to **layer** (network, TLS, HTTP, app, data).
4. Propose **specific** next checks (header, clock, CORS, body schema) and **code or config** changes only where evidence points.
5. Remind to **rotate credentials** if they were exposed in chat or logs.

---

## Anti-patterns

- Changing random timeouts without measuring.
- Disabling TLS verification in production code.
- Logging full request bodies in production (PII, tokens).
- Treating “works on my machine” as sufficient without matching env and URL.

---

## Optional one-page template (for issues/PRs)

- **Endpoint**: METHOD URL  
- **Expected**: status + shape  
- **Actual**: status + body snippet (redacted)  
- **Repro**: curl command (secrets redacted)  
- **Works in**: Postman / curl / browser / server only — which?  
- **Recent changes**: deploy, config, dependency versions  

This skill does not replace API-specific documentation; always align with the service’s official spec and security guidelines.
