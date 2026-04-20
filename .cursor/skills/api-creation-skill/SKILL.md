---
name: api-creation
description: >-
  Designs and implements HTTP APIs (REST, JSON, webhooks, OpenAPI contracts):
  resource modeling, versioning, auth, errors, pagination, idempotency, rate
  limits, and security. Use when creating new APIs, extending endpoints,
  choosing patterns for clients, writing OpenAPI/Swagger specs, or when the
  user asks to design or build an API surface.
---

# API creation

This skill guides **designing**, **implementing**, and **documenting** HTTP APIs that are predictable, secure, and easy to evolve. For **testing failures**, **CORS**, or **request tracing**, use the **api-debugging** skill instead; this document focuses on **building** the contract and server behavior.

## When to apply

- Greenfield API or new major resource/capability.
- Adding endpoints, versions, or breaking changes (deprecation strategy).
- Choosing auth (API keys, OAuth2, JWT), error shape, pagination, or webhooks.
- Producing or maintaining **OpenAPI** (or similar) and consumer-facing docs.

## Core principles

1. **Contract first or contract in lockstep**: Publish machine-readable spec (OpenAPI, GraphQL SDL) alongside implementation; avoid “undocumented behavior.”
2. **Resources, not RPC-by-URL**: Prefer nouns and collections; use HTTP semantics; keep actions explicit when they are not CRUD (`POST /v1/invoices/{id}/send`).
3. **Consistent envelopes**: Same error structure, pagination pattern, and date/ID formats everywhere.
4. **Safe evolution**: Additive changes preferred; version or deprecate before breaking clients.
5. **Security by default**: TLS, least-privilege scopes, validate all input, never rely on obscurity.

---

## 1. Requirements and boundaries

Before coding, clarify:

| Question | Why it matters |
|----------|----------------|
| **Who are the clients?** (web, mobile, partners, internal services) | Auth model, rate limits, payload size, versioning |
| **Sync vs async?** | Long jobs need status URLs, webhooks, or polling |
| **SLA and scale?** | Pagination, caching headers, idempotency for payments |
| **Regulatory / PII?** | Audit fields, retention, field-level access, regional rules |

Document **non-goals** (what the API will not do) to avoid scope creep.

---

## 2. Resource modeling (REST-style JSON)

- **Collections**: plural nouns — `GET /v1/users`, `POST /v1/users`.
- **Single resource**: `GET /v1/users/{userId}` — use stable IDs (opaque strings, UUIDs), not auto-increment exposed if it leaks enumeration risk.
- **Sub-resources**: `GET /v1/users/{userId}/orders` when ownership is clear; avoid deep trees (`/a/b/c/d/e`) — consider separate top-level collections with filters.
- **Actions**: If an operation is not a natural CRUD mapping, use **verbs as sub-paths** or **command resources**: `POST /v1/subscriptions/{id}/cancel` or `POST /v1/cancellation-requests` with a body.

**Naming**

- **kebab-case** or **snake_case** for path segments — pick one per API; JSON properties often **snake_case** (common in public APIs) or **camelCase** (common in JS clients) — **be consistent**.
- Avoid abbreviations unless industry-standard (`id`, `url`, `html`).

---

## 3. HTTP methods and semantics

| Method | Typical use | Success codes |
|--------|-------------|----------------|
| **GET** | Read; safe; cacheable | **200** (+ body), **304** if caching |
| **POST** | Create or non-idempotent action | **201** + `Location` when creating, **200**/204 for actions |
| **PUT** | Replace full resource (idempotent) | **200** or **204** |
| **PATCH** | Partial update (RFC 7386 JSON Merge Patch or explicit JSON Patch) | **200** or **204** |
| **DELETE** | Remove | **204** (no body) or **202** if delete is async |

- Return **405 Method Not Allowed** with **`Allow`** header when method does not apply.
- **HEAD** / **OPTIONS**: support if SEO, caching, or CORS preflight matter.

---

## 4. Status codes (consistent policy)

Define a **small documented set** the API uses on purpose:

- **200**: OK with body.
- **201**: Created; include **`Location`** and often the representation.
- **204**: Success, no body (common for DELETE, some PATCH).
- **400**: Malformed request (bad JSON, wrong type) — client can fix.
- **401**: Authentication required or failed.
- **403**: Authenticated but not allowed (RBAC, missing scope).
- **404**: Resource not found (avoid leaking existence of protected resources if policy requires — sometimes **403** is safer).
- **409**: Conflict (duplicate unique key, wrong state for transition).
- **412** / **428**: Preconditions (If-Match / If-Unmodified-Since) when using concurrency control.
- **422**: Semantic validation (popular convention; some APIs use **400** — pick one).
- **429**: Rate limited; include **`Retry-After`** when possible.
- **500**: Unexpected server error — generic message externally; details in logs.

Avoid using **HTTP 200** with an error payload for REST JSON APIs; exceptions exist for legacy or GraphQL-over-HTTP.

---

## 5. Error responses (structured)

Prefer a **single error object shape** for all 4xx/5xx (unless using **RFC 9457 Problem Details** (`application/problem+json`)):

Recommended fields (subset of Problem Details + your codes):

- **`type`**: URI identifying the error kind (stable, documentation link).
- **`title`**: Short human-readable summary.
- **`status`**: HTTP status (duplicate for convenience).
- **`detail`**: Specific to this request (no stack traces in production).
- **`instance`**: Optional correlation id or request id.
- **`code`**: Machine-readable string (`INSUFFICIENT_FUNDS`, `INVALID_EMAIL`) for clients to branch on.

**Validation errors**: Return field-level errors in a consistent structure, e.g. `errors: [{ "field": "email", "message": "...", "code": "..." }]`.

Never expose internal hostnames, SQL, or stack traces in external responses.

---

## 6. Versioning

Pick **one** primary strategy and document it:

| Strategy | Pros | Cons |
|----------|------|------|
| **URL path** (`/v1/...`) | Visible, easy routing | Proliferation of paths |
| **Header** (`Accept: application/vnd.company.v1+json`) | Clean URLs | Harder to test in browser |
| **Query** | Rare for major versions | Easy to forget |

- **Prefer URL prefix** for public APIs unless organization standard says otherwise.
- **Minor** changes: new optional fields, new endpoints — usually no new version.
- **Breaking** changes: new major version; keep old version for a **deprecation window** with dates and migration guide.

---

## 7. Pagination, filtering, sorting

**Offset/limit** (simple, poor for large moving datasets):

- `?limit=50&offset=100` — document max `limit`; warn about skipped/duplicate rows under concurrent writes.

**Cursor-based** (preferred for feeds and scale):

- `?limit=50&cursor=opaque` — stable ordering required; document sort.
- Response: `{ "data": [...], "next_cursor": "..." }` or Link header `rel="next"`.

**Filtering**: `?status=active&created_after=...` — whitelist allowed fields; reject unknown filters explicitly if that helps clients.

**Sorting**: `?sort=created_at` and `?order=desc` — whitelist fields.

---

## 8. Authentication and authorization

**Patterns**

- **API keys**: Header `Authorization: Bearer <key>` or `X-Api-Key` — rotate keys; scope per environment.
- **OAuth2 / OpenID Connect**: For user-delegated access; document scopes; use **PKCE** for public clients.
- **JWT**: Short TTL; validate `iss`, `aud`, `exp`; prefer opaque tokens + introspection for high-security contexts.
- **mTLS**: Service-to-service on private networks.

**Authorization**

- Enforce **after** authentication; map roles/scopes to capabilities.
- Return **403** when identity is known but action is forbidden; **401** when identity is missing/invalid.

Never log raw tokens or API keys.

---

## 9. Idempotency and safe retries

- **GET**, **PUT**, **DELETE** (in theory): design for idempotent semantics.
- **POST** (payments, orders): support **`Idempotency-Key`** header; store key → response for TTL; return same response on replay.
- Document which operations are safe to retry after **408**, **429**, **502**, **503**, **504**.

---

## 10. Rate limiting and quotas

- Return **429** with **`Retry-After`** (seconds or HTTP-date).
- Optional headers: **`X-RateLimit-Limit`**, **`X-RateLimit-Remaining`**, **`X-RateLimit-Reset`** (convention; not standardized).
- Different limits for authenticated vs anonymous; per-API-key vs per-IP as appropriate.

---

## 11. Webhooks (outbound events)

When the API pushes to consumer URLs:

- **Signing**: HMAC over **raw body** (e.g. `X-Signature` or `X-Hub-Signature-256`); include timestamp to prevent replay (`X-Timestamp` + tolerance).
- **Retries**: Exponential backoff; cap attempts; document final failure behavior.
- **Ordering**: Assume **at-least-once** delivery; consumers must dedupe by event `id`.
- **Payload**: Version event schema (`type`, `api_version`, `data`); keep minimal; allow fetching full object by ID if needed.

---

## 12. Long-running and async operations

- **202 Accepted** + **`Location`** of a **status resource** (`GET /v1/jobs/{jobId}`), or webhook on completion.
- Avoid blocking HTTP for seconds unless documented and client timeouts aligned.

---

## 13. File uploads

- **Small files**: `multipart/form-data` on a dedicated endpoint.
- **Large files**: presigned **PUT** to object storage (S3/GCS) + **`POST /complete`** to register metadata — avoids huge app server bodies.
- Validate **type**, **size**, and **virus/malware** policy at boundary.

---

## 14. CORS (server configuration)

If browsers call the API directly:

- Configure **preflight** for non-simple methods and custom headers.
- **`Access-Control-Allow-Origin`**: specific origins when using credentials; avoid `*` with credentials.
- **`Access-Control-Allow-Headers`**: include `Authorization`, `Content-Type`, and any custom headers.
- See **api-debugging** for triage when CORS breaks in browser only.

---

## 15. Observability

- **Correlation ID**: Accept `X-Request-Id` or generate one; return in response; log structured fields.
- **Logging**: Route, status, duration, error **code**; no secrets or full bodies in production.
- **Metrics**: RPS, latency histograms, error rate by route and status.

---

## 16. OpenAPI (contract) practices

- One **OpenAPI 3.x** document per API surface; generate **types** and **mock servers** where the repo supports it.
- Describe **security schemes**, **parameters**, **requestBody**, **responses** including error schema.
- Mark **deprecated** operations with explanation and sunset date.
- CI: lint spec (Spectral or equivalent) and **break detection** on PRs when consumers rely on contracts.

---

## 17. GraphQL (when REST is not chosen)

- Schema-first; enforce **depth/complexity** limits; timeouts on execution.
- Errors: HTTP **200** with `errors` array is normal — document that clients must check `errors`.
- N+1: use **DataLoader** or equivalent; document pagination (`first`/`after` cursors).

---

## 18. Documentation for consumers

Minimum:

- Base URL, auth, versioning policy, and **changelog**.
- Per endpoint: method, path, parameters, request/response examples, error codes.
- **Rate limits** and **webhook** signing verification steps.

---

## 19. Security checklist (before launch)

- TLS everywhere; HSTS for public browser-facing hosts.
- Input validation (JSON schema or equivalent); output encoding; max body size.
- CSRF: less relevant for pure **Bearer** token APIs; critical for cookie-based browser sessions.
- SSRF: validate URLs users supply for webhooks/callbacks.
- Injection: parameterized queries; no string-built SQL/NoSQL/LDAP.
- Dependencies: scan for known CVEs; lockfiles in CI.

---

## 20. Agent behavior checklist

When helping **create** an API:

1. Clarify **clients**, **auth**, **sync/async**, and **breaking-change** policy.
2. Propose **resource model**, **URLs**, **methods**, and **status/error** conventions before implementation details.
3. Add **versioning**, **pagination**, and **idempotency** where scale or money is involved.
4. Produce or update **OpenAPI** (or GraphQL SDL) **in the same change** as new endpoints when the repo uses contracts.
5. Call out **CORS**, **rate limits**, and **webhook signing** when the surface is browser- or event-driven.

---

## Anti-patterns

- Inconsistent field naming or error shapes across endpoints.
- Overloading **POST** for everything with opaque `action` fields when RESTful modeling is clearer.
- Breaking clients silently (changing types or required fields without version bump or deprecation).
- Returning huge unbounded lists without pagination.
- Storing or transmitting secrets in query strings (logs, Referer leakage).

---

## Related

- **api-debugging** skill: systematic testing and fixing of failing requests, CORS, and webhooks from the **consumer** side.

This skill does not replace organizational API standards; align with internal gateways, IAM, and compliance requirements.
