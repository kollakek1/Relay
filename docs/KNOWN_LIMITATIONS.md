# Relay — Known limitations

This file is deliberately blunt. It lists what Relay does **not** do yet, what
is intentionally out of scope, and the residual risks that remain after the
hardening pass. Nothing here is a promise; each item says why it is where it is.

Legend: 🔴 security-relevant residual · 🟠 functional gap · 🔵 operational.

## Security (residual)

- 🔴 **SSRF DNS rebinding (TOCTOU).** Outbound webhook requests resolve the host
  and reject private/reserved addresses before connecting
  (`shared/server/ssrf.ts`), but the socket is opened by the runtime a moment
  later. An attacker who controls DNS could, in principle, answer with a public
  address during the check and a private one during the connection. Fully
  closing this needs connect-time address pinning or a controlled egress proxy.
  The resolve-then-check blocks the realistic attack and is documented in
  `docs/THREAT_MODEL.md`.
- 🔴 **Rate limiting is a fixed window.** Counters reset on window expiry, so a
  burst across a boundary can exceed the nominal limit. Adequate for abuse
  control; not a precise quota. A sliding window / token bucket is the upgrade.
- 🔴 **Email verification is disabled.** Better Auth is configured with
  `requireEmailVerification: false`. Account creation is therefore not gated on
  owning the mailbox. Invitations are still bound to the invitee's email.
- 🔴 **Audit log is append-only by convention.** The `org_audit_log` table is not
  protected by database triggers or restricted roles; an operator with database
  access can alter it.
- 🔴 **File uploads / attachments are not implemented.** There is no object
  storage, so there is no upload attack surface — and no attachment feature.
- 🔴 **`sslmode=require` semantics.** The `pg` driver currently treats `require`
  like `verify-full`. Pin `sslmode=verify-full` explicitly in production so a
  future driver change cannot silently weaken TLS.

## Functional gaps

- 🟠 **Localization coverage.** The dashboard and authentication interface —
  navigation, workflows, templates, tasks, approvals, members, permissions,
  settings, automations, webhooks, API keys, notifications, analytics, search,
  empty states, confirmations and toasts — is available in **six** languages:
  English, Russian, Ukrainian, German, Belarusian and Kazakh. Parity across all
  six is enforced by the type system (`Messages`) and `npm run i18n:check`.
  What is intentionally **not** translated: technical identifiers (API scopes,
  webhook event names, trigger/action ids, condition operators and field-type
  values, timezone ids, HTTP codes, URLs, code fragments). Server-generated error
  messages are not localized at the source; instead `useAction` maps the
  `ActionResult` code to a translated message, so the user never sees a raw
  server string.
- 🟠 **Long-form site content is EN/RU only.** The marketing landing page, the
  documentation pages, the public changelog and the legal drafts
  (`shared/i18n/content.ts`) are authored in English and Russian. Ukrainian,
  German, Belarusian and Kazakh fall back to the English long-form content via
  `getContent()` — a safe fallback, not a machine translation. Translating this
  prose is a future task.
- 🟠 **Some date/number helpers are not locale-aware.** `shared/lib/format.ts`
  formats dates with the runtime default locale and has a few English-only
  relative-time strings ("2h ago"). `shared/i18n/format.ts` is the locale-aware
  successor, but not every panel has been migrated to it yet.
- 🟠 **Workflow execution is linear.** Steps run in order with conditional skips
  and task dependencies. There is no parallel branch, no join/gateway and no
  BPMN execution semantics.
- 🟠 **No scheduled/recurring process triggers.** Instances are started manually
  or via the API. There is no "run every Monday" scheduler.
- 🟠 **Automation actions are a fixed set** (`notify_role`, `add_tag`,
  `set_priority`, `create_task`). Arbitrary webhook-calling actions are not
  offered, precisely to avoid turning the automation engine into a generic SSRF
  primitive.
- 🟠 **Authorization is fixed-role plus additive grants.** There are exactly
  three roles (`OWNER`, `ADMIN`, `MEMBER`) and a fixed permission catalogue
  (`shared/server/permissions.ts`). An administrator can grant *individual*
  extra permissions to a member (for example `workflow.start`), but there is no
  arbitrary custom-role builder — this is deliberate, to keep the model
  auditable. A member can never be granted a permission the acting administrator
  does not hold herself.
- 🟠 **`workflow.cancel` has no dedicated UI.** The permission exists in the
  catalogue and is enforced, but a running instance is currently cancelled only
  as a consequence of an approval rejection; there is no standalone "cancel this
  run" button.
- 🟠 **Instances are archived, not purged.** A finished *run* can be archived (a
  reversible soft delete) but not individually hard-deleted: its tasks, comments,
  activity, notifications, outbox events and audit trail are preserved so
  analytics and investigations stay intact. A **workflow** however can be
  archived (hides it, keeps its runs) or, with an explicit confirmation, deleted
  together with all its runs — which does destroy that run history. A workflow
  with a still-running instance can never be deleted. There is no time-based
  retention/purge job.
- 🟠 **No billing, no AI provider, no Telegram/other chat integrations.**
- 🟠 **Analytics is bounded-sample.** At most 2000 instances/tasks per query are
  aggregated in application code. Beyond that the numbers are representative,
  not exhaustive; the fix is a materialised rollup table.

## Reliability semantics (be precise)

- 🔵 **Delivery is at-least-once, not exactly-once.** In-database effects are
  effectively-once (unique keys, atomic claims, transactional actions), but a
  webhook receiver may see the same delivery more than once. Receivers must
  deduplicate on `x-relay-delivery`.
- 🔵 **A crash between an external HTTP call and the status update can re-deliver.**
  This is inherent to at-least-once delivery without a distributed transaction.
- 🔵 **Automation retries replay the action.** Actions are written to be
  idempotent (tag presence check, deterministic follow-up task lookup), but the
  engine cannot make an arbitrary side effect idempotent.

## Operational

- 🔵 **i18n makes translated pages dynamic.** The locale is read from a cookie in
  the root layout so SSR and `<html lang>` are correct. As a result `/` and the
  docs are rendered per request rather than statically. `/robots.txt` and
  `/sitemap.xml` remain static.
- 🔵 **A cron scheduler is required for background work.** Relay has no worker;
  without calling `POST /api/jobs/drain` and `POST /api/jobs/sla-scan`,
  deliveries are never attempted and SLA notifications are never raised. Both
  endpoints return `503` when `CRON_SECRET` is unset, rather than silently doing
  nothing.
- 🔵 **Browser E2E is gated.** A Playwright smoke test is provided
  (`e2e/`, `npm run test:e2e`) but requires a live PostgreSQL, migrations and a
  running server, so it is opt-in (`E2E=1`) and off by default in CI.
- 🔵 **No migrations-runner sidecar / zero-downtime deploy story.** Migrations are
  applied with `prisma migrate deploy` before starting the new build; a short
  maintenance window is expected for schema changes.
- 🔵 **No built-in observability backend.** Logs are single-line JSON on stdout;
  job outcomes are recorded in `job_run`. There is no metrics endpoint or
  tracing.
