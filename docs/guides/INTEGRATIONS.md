# Relay — Integrations (API & webhooks)

Repository copy of the integrations guide (also rendered at `/docs/integrations`).
The interactive reference lives at `/api-reference`, and the machine-readable
specification at `/api/openapi` (source: `docs/api/openapi.json`).

## API keys

Create a key in **Settings → API keys**. The raw value (`rk_…`) is shown exactly
once; only its SHA-256 hash is stored.

Scopes:

- `workflows:read`
- `tasks:read`
- `tasks:write`
- `instances:read`
- `instances:write`

A key acts with the **current** role of the account that created it. Remove or
demote that user and the key's authority shrinks immediately. Revoking a key is
instant.

## Endpoints

| Method | Path | Scope |
| --- | --- | --- |
| `GET` | `/api/v1/workflows` | `workflows:read` |
| `POST` | `/api/v1/workflows/{id}/run` | `instances:write` |
| `GET` | `/api/v1/instances` | `instances:read` |
| `GET` | `/api/v1/tasks` | `tasks:read` |
| `GET` | `/api/v1/tasks/{id}` | `tasks:read` |
| `POST` | `/api/v1/tasks/{id}/claim` | `tasks:write` |

Responses are uniform: `{ "data": ... }` on success (list endpoints add a `meta`
object with `total`, `page`, `pageSize`), and `{ "error": { "code", "message" } }`
on failure. `GET /api/v1/tasks` supports `status`, `kind`, `assignee`, `priority`,
`q`, `sort`, `direction` and `page`.

## Authentication

```bash
curl https://your-host/api/v1/tasks?status=PENDING \
  -H "Authorization: Bearer $RELAY_API_KEY"
```

Never put a key in a URL, a query string or a browser address bar.

## Errors

| Status | Code | Meaning |
| --- | --- | --- |
| 401 | `unauthorized` | Missing / invalid / revoked key. |
| 403 | `forbidden` | The key lacks the required scope. |
| 404 | `not_found` | Not in this workspace (also used instead of 403 to avoid leaks). |
| 409 | `conflict` | Lost a race (e.g. the task was already claimed). |
| 422 | `validation` | Input rejected. |
| 429 | `rate_limited` | Per-key rate limit exceeded. |
| 500 | `internal` | Unexpected server error (details are never returned). |

## Webhooks

Subscribe an endpoint to one or more events. Deliveries are `POST` requests with
these headers:

- `x-relay-event` — the event name.
- `x-relay-delivery` — a stable delivery id; deduplicate on this.
- `x-relay-timestamp` — Unix seconds used in the signature.
- `x-relay-signature` — `t=<unix>,v1=<hex>`.

Events: `task.created`, `task.claimed`, `task.completed`, `task.decided`,
`instance.started`, `instance.completed`, `workflow.published`.

### Verifying a signature

The signed string is `"<t>.<raw body>"`:

```javascript
import { createHmac, timingSafeEqual } from 'node:crypto'

export function verify(secret, rawBody, header, toleranceSeconds = 300) {
  const [t, v1] = header.split(',').map((part) => part.split('=')[1])
  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranceSeconds) return false

  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(v1 ?? '')
  return a.length === b.length && timingSafeEqual(a, b)
}
```

Use the **raw** request body (before JSON parsing). Reject old timestamps to
limit replay, then deduplicate on `x-relay-delivery` — delivery is at-least-once.

### Endpoint safety

Outbound URLs are validated before use: only `http(s)`, no embedded credentials,
blocked ports unless allow-listed, and blocked private/reserved addresses
(including after DNS resolution). Redirects are never followed. See
`docs/THREAT_MODEL.md` for the residual DNS-rebinding caveat.

### Delivery state

Deliveries are retried with exponential backoff and jitter. After the attempt cap
they become `FAILED` and the endpoint's failure count increases; enough exhausted
deliveries disable the endpoint. Admins can requeue a failed delivery from the
webhooks panel.