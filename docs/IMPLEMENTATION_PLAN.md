# Relay — Implementation Plan (V2 hardening pass)

This plan drives the hardening / polish pass. It is ordered so that correctness
and security land before cosmetics. Each phase lists concrete, checkable work.

Legend: ✅ done · 🚧 in progress · ⬜ not started

---

## Phase A — Security & reliability ✅

- [ ] **A1 Seed hardening** — remove default/weak root credentials, never log
      secrets, gate demo data, refuse unsafe production config.
- [ ] **A2 Cron auth** — `Authorization: Bearer` only, timing-safe compare,
      POST-only for state changes, shared helper, docs.
- [ ] **A3 Outbox/automation reliability** — atomic `FOR UPDATE SKIP LOCKED`
      claim + lease, bounded retries with backoff + jitter, explicit states,
      dead-letter + requeue, batch isolation.
- [ ] **A4 Webhook concurrency** — idempotent fan-out via a unique index;
      single-attempt delivery guarded by lease.
- [ ] **A5 CSV Formula Injection** — shared safe cell helper, tests.
- [ ] **A6 Analytics correctness** — scope per workflow, key bottlenecks by
      `(workflowId, stepOrder)`, guard divide-by-zero.
- [ ] **A7 SSRF** — resolve-then-check, IP classification, port policy,
      no redirects, bounded responses.
- [ ] **A8 Extra security review** — invitation race, tenant isolation, RBAC,
      API-key scopes, webhook replay, no secret leakage.
- [ ] **A9 Regression tests** — `tests/job-auth.test.ts`,
      `tests/seed-hardening.test.ts`, `tests/csv-export.test.ts`,
      `tests/ssrf.test.ts`, `tests/outbox-reliability.test.ts`,
      `tests/security-regression.test.ts`.

## Phase B — Prisma & clean Git ✅

- [ ] Keep schema fragments, migrations, seed, `prisma.config.ts` tracked.
- [ ] Stop tracking `prisma/generated/prisma/`; ignore it in `.gitignore`
      (without ignoring `prisma/`, `schema/` or `migrations/`).
- [ ] Reproducible generation: `postinstall` runs `prisma generate`;
      `typecheck`/`build` depend on generation; CI generates from a clean checkout.
- [ ] Migration workflow documented for dev / CI / production.

## Phase C — i18n foundation ✅

- [ ] Typed dictionary-based i18n compatible with App Router server + client
      components; no locale segment that would break existing routes.
- [ ] `messages/en.json` / `messages/ru.json` with a typed key union.
- [ ] Locale resolution: cookie → `Accept-Language` → default; persisted.
- [ ] Language switcher on public site + in the app.
- [ ] Date/number/percent formatting helpers bound to the active locale.
- [ ] Completeness + missing-key checks (`npm run i18n:check`, tests).

## Phase D — Localization coverage ✅

- [ ] Public marketing site fully localized (RU/EN).
- [ ] App chrome, navigation, auth, empty/error/loading states, toasts,
      dialogs, form validation messages localized.
- [ ] Email templates (invitation) localized.
- [ ] SEO metadata localized; `lang` attribute reflects the active locale.
- [ ] Documented remaining machine-facing strings (API field names, ids).

## Phase E — Public site & UX ✅

- [ ] Landing page rebuilt with the 15 required sections.
- [ ] `/features`, `/docs/*`, `/api-reference`, `/changelog`, `/privacy`,
      `/terms`, `/404`, error page.
- [ ] Responsive, accessible, light/dark.
- [ ] Working CTAs and links only — no dead buttons.

## Phase F — Documentation & API Reference ✅

- [ ] `docs/` guide set (quickstart, deployment, configuration, workflows,
      automations, integrations, architecture, security, testing).
- [ ] `docs/api/openapi.yaml` (OpenAPI 3.1) describing only implemented routes.
- [ ] Interactive `/api-reference` with search, groups, examples, download.
- [ ] OpenAPI + i18n validation in CI and `npm run api:check` / `i18n:check`.

## Phase G — Final verification 🚧

- [ ] Full security regression suite.
- [ ] Prisma clean generation from a fresh checkout of `prisma/` only.
- [ ] Production build.
- [ ] Manual RU/EN spot check of public pages and dashboard chrome.
- [ ] Playwright E2E (provided, gated behind `E2E=1` — needs a live DB + server).
- [ ] README, roadmap and limitations updated.
- [ ] Final report in `docs/PRODUCTION_HARDENING.md`.
