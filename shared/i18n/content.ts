/**
 * Long-form, locale-specific content: the landing page narratives, the
 * documentation pages, the changelog and the legal drafts.
 *
 * This lives outside `messages/*` because it is prose, not UI chrome. `ru` is
 * typed as `SiteContent` (derived from the English source), so the compiler
 * rejects a Russian site that is missing a section or block. UI labels stay in
 * `messages/*`, where `i18n:check` enforces completeness.
 */
import { DEFAULT_LOCALE, type Locale } from './config'

export interface ListItem {
  title: string
  body: string
}

export type DocBlock =
  | { kind: 'p'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'code'; language: string; code: string }
  | { kind: 'note'; text: string }

export interface DocPage {
  title: string
  lead: string
  blocks: DocBlock[]
}

export interface Release {
  version: string
  date: string
  items: string[]
}

export interface LegalPage {
  title: string
  lead: string
  draftNotice: string
  blocks: DocBlock[]
}

export type DocSlug =
  | 'quickstart'
  | 'architecture'
  | 'security'
  | 'deployment'
  | 'configuration'
  | 'workflows'
  | 'automations'
  | 'integrations'

export interface SiteContent {
  landing: {
    lifecycle: ListItem[]
    work: ListItem[]
    api: ListItem[]
    security: ListItem[]
    developers: ListItem[]
    quickstartSteps: ListItem[]
    quickstartCode: string
  }
  docs: Record<DocSlug, DocPage>
  changelog: Release[]
  legal: { privacy: LegalPage; terms: LegalPage }
}

const en: SiteContent = {
  landing: {
    lifecycle: [
      {
        title: 'Design the process',
        body: 'Add steps, choose task or approval, attach form fields and conditions, then validate the draft.',
      },
      {
        title: 'Publish a version',
        body: 'Publishing freezes an immutable snapshot. Later edits never alter instances that are already running.',
      },
      {
        title: 'Run an instance',
        body: 'Starting a run creates one task per step and releases them in order as the process advances.',
      },
      {
        title: 'Complete and review',
        body: 'People claim work, approvals resolve, and analytics accumulate real cycle-time and bottleneck data.',
      },
    ],
    work: [
      {
        title: 'A shared task pool',
        body: 'Unassigned work is claimed with a single atomic update, so two people can never hold the same task.',
      },
      {
        title: 'Explicit approvals',
        body: 'Any-approver or all-approver decisions, with request-changes and reject outcomes and a full decision log.',
      },
      {
        title: 'Automation rules',
        body: 'React to domain events with notifications and task mutations. Each rule runs at most once per event.',
      },
    ],
    api: [
      {
        title: 'Scoped API keys',
        body: 'Keys are stored only as hashes and carry explicit capabilities such as tasks:write or instances:read.',
      },
      {
        title: 'Versioned REST API',
        body: 'A stable /api/v1 surface with uniform errors, pagination and per-key rate limits.',
      },
      {
        title: 'Signed webhooks',
        body: 'HMAC-SHA256 signatures with a timestamp, delivered through a transactional outbox with retries.',
      },
    ],
    security: [
      {
        title: 'Tenant isolation',
        body: 'Every query is scoped to the caller’s organization on the server; a foreign id resolves to “not found”.',
      },
      {
        title: 'Roles enforced server-side',
        body: 'Owner, admin and member capabilities are re-derived from the database on every request.',
      },
      {
        title: 'Boring, safe defaults',
        body: 'No default administrator credentials, no secrets in URLs, and outbound requests are guarded against SSRF.',
      },
    ],
    developers: [
      {
        title: 'Readable layering',
        body: 'Routes, feature modules, a service layer and a shared authorization core — each with one clear job.',
      },
      {
        title: 'A real test suite',
        body: 'Unit and integration tests cover authorization, concurrency, retries, analytics and security regressions.',
      },
      {
        title: 'Typed end to end',
        body: 'TypeScript in strict mode, Zod at every boundary, and a Prisma schema that is the source of truth.',
      },
    ],
    quickstartSteps: [
      { title: 'Install', body: 'Clone the repository and install dependencies.' },
      { title: 'Configure', body: 'Set the database URL and the auth secret in .env.' },
      { title: 'Migrate and run', body: 'Apply migrations, seed the first administrator and start the server.' },
    ],
    quickstartCode: `git clone https://github.com/kollakek1/Relay
cd Relay
npm install                 # also generates the Prisma client
cp .env.example .env        # set DATABASE_URL + BETTER_AUTH_SECRET

npm run db:deploy           # apply migrations
npm run db:seed             # first administrator (ROOT_EMAIL + strong ROOT_PASSWORD)
npm run dev                 # http://localhost:3000`,
  },

  docs: {
    quickstart: {
      title: 'Quickstart',
      lead: 'From a fresh clone to a running workflow instance. Every command matches this repository.',
      blocks: [
        { kind: 'h2', text: 'Prerequisites' },
        {
          kind: 'ul',
          items: [
            'Node.js 20 or newer (CI runs Node 24).',
            'PostgreSQL 14 or newer, reachable from the machine running Relay.',
            'No other external services are required.',
          ],
        },
        { kind: 'h2', text: 'Install and configure' },
        {
          kind: 'code',
          language: 'bash',
          code: `git clone https://github.com/kollakek1/Relay
cd Relay
npm install

cp .env.example .env
# Edit .env and set DATABASE_URL and BETTER_AUTH_SECRET.`,
        },
        {
          kind: 'note',
          text: 'npm install runs `prisma generate` automatically. The generated Prisma client is not committed; it is rebuilt from prisma/schema.',
        },
        { kind: 'h2', text: 'Migrate and create the first administrator' },
        {
          kind: 'code',
          language: 'bash',
          code: `npm run db:deploy   # apply migrations
ROOT_EMAIL=you@example.com ROOT_PASSWORD='a-strong-unique-password' npm run db:seed`,
        },
        {
          kind: 'note',
          text: 'The seed refuses missing, short or placeholder passwords and never prints the password. Set SEED_DEMO_DATA=true to also create a sample workspace.',
        },
        { kind: 'h2', text: 'Run the app' },
        {
          kind: 'code',
          language: 'bash',
          code: `npm run dev   # http://localhost:3000`,
        },
        { kind: 'h2', text: 'Create and run your first workflow' },
        {
          kind: 'ul',
          items: [
            'Sign in and open Workflows, then create a workflow.',
            'Add steps; mark a step as an approval if it needs a decision.',
            'Publish the workflow — this freezes version 1.',
            'Open Runs and start an instance.',
            'Claim the generated task from the Task pool and complete it.',
          ],
        },
        { kind: 'h2', text: 'Troubleshooting' },
        {
          kind: 'ul',
          items: [
            '“DATABASE_URL environment variable is not set” — the .env file is missing or not loaded.',
            'Cannot reach the database — verify the host, port, credentials and TLS mode in DATABASE_URL.',
            'Seed aborted — provide a strong ROOT_PASSWORD and a valid ROOT_EMAIL.',
            'Type errors after pulling — run npm run db:generate to refresh the Prisma client.',
          ],
        },
      ],
    },

    architecture: {
      title: 'Architecture',
      lead: 'How the layers fit together, and why the boundaries are where they are.',
      blocks: [
        { kind: 'h2', text: 'Layers' },
        {
          kind: 'ul',
          items: [
            'app/ — route handlers, server actions entry points and pages.',
            'features/<domain>/ — schemas (Zod), server services, actions and components.',
            'shared/server/ — authorization, errors, logging, rate limiting, retries and SSRF guards.',
            'shared/components/ui/ — presentational primitives only.',
            'prisma/ — schema fragments, migrations and the seed.',
          ],
        },
        { kind: 'h2', text: 'Request flow' },
        {
          kind: 'p',
          text: 'A mutation arrives as a server action. It resolves the authorization context (user + active organization + role), validates input with Zod, and calls a service. The service is the only layer that talks to Prisma, and every query is scoped by organizationId.',
        },
        { kind: 'h2', text: 'Authorization' },
        {
          kind: 'p',
          text: 'The active workspace is stored in a cookie but is always re-validated against a real membership. Roles form the hierarchy OWNER > ADMIN > MEMBER, defined in one place (shared/server/permissions.ts).',
        },
        { kind: 'h2', text: 'Execution model' },
        {
          kind: 'p',
          text: 'Publishing captures an immutable version. Instances reference that version, so editing a draft never affects running work. Tasks are released step by step and claimed atomically.',
        },
        { kind: 'h2', text: 'Background work without a worker' },
        {
          kind: 'p',
          text: 'Relay has no long-running worker. Domain events are written to a transactional outbox in the same transaction as the mutation, then fanned out by a bounded job. Outbox events, webhook deliveries and automation runs are claimed with SELECT … FOR UPDATE SKIP LOCKED plus a lease, retried with exponential backoff and jitter, and dead-lettered when exhausted.',
        },
      ],
    },

    security: {
      title: 'Security',
      lead: 'The trust boundaries, what is enforced today, and the residual risks we document.',
      blocks: [
        { kind: 'h2', text: 'Trust boundaries' },
        {
          kind: 'p',
          text: 'The browser is untrusted. Identifiers, roles and form values are re-derived and validated on the server. The database is the only trusted store; no in-memory state is relied on for correctness.',
        },
        { kind: 'h2', text: 'Enforced controls' },
        {
          kind: 'ul',
          items: [
            'Tenant isolation on every read and write, with “not found” for foreign identifiers.',
            'Role checks in the service layer, never in the client.',
            'Invitation tokens are stored hashed, expire, are single-use and must match the invitee email.',
            'API keys are stored as SHA-256 hashes and carry scopes; they act with the creator’s current role.',
            'Webhook deliveries are HMAC-SHA256 signed with a timestamp and delivered at least once.',
            'Database-backed rate limiting protects mutation endpoints.',
            'Cron endpoints accept Authorization: Bearer only, compared in constant time; secrets never appear in URLs.',
            'CSV exports neutralise formula injection.',
            'Outbound requests are guarded: scheme allow-list, no credentials, private/reserved address blocking, DNS resolve-then-check, no redirect following and bounded responses.',
          ],
        },
        { kind: 'h2', text: 'Secrets and configuration' },
        {
          kind: 'p',
          text: 'BETTER_AUTH_SECRET is required in production. CRON_SECRET protects the job endpoints. Root credentials are supplied only for the first seed run and are never defaulted or logged.',
        },
        { kind: 'note', text: 'See docs/THREAT_MODEL.md for the full table of threats and the residual-risk list.' },
      ],
    },

    deployment: {
      title: 'Deployment',
      lead: 'Self-hosting Relay on your own PostgreSQL, from a local machine to a serverless platform.',
      blocks: [
        { kind: 'h2', text: 'Build and start' },
        {
          kind: 'code',
          language: 'bash',
          code: `npm ci
npx prisma migrate deploy   # apply migrations
npm run build
npm run start               # serves the production build`,
        },
        { kind: 'h2', text: 'Required environment' },
        {
          kind: 'ul',
          items: [
            'DATABASE_URL — a PostgreSQL connection string.',
            'BASE_URL — the public origin, used by the auth layer and invite links.',
            'BETTER_AUTH_SECRET — a long random secret (openssl rand -base64 32).',
          ],
        },
        { kind: 'h2', text: 'Scheduled jobs' },
        {
          kind: 'p',
          text: 'Call the job endpoints from any scheduler. Use POST with Authorization: Bearer <CRON_SECRET>; the secret is never accepted in the query string.',
        },
        {
          kind: 'code',
          language: 'bash',
          code: `# every minute
curl -X POST https://your-host/api/jobs/drain -H "Authorization: Bearer $CRON_SECRET"
# every hour
curl -X POST https://your-host/api/jobs/sla-scan -H "Authorization: Bearer $CRON_SECRET"`,
        },
        { kind: 'h2', text: 'Email' },
        {
          kind: 'p',
          text: 'Email is optional. Without RESEND_API_KEY and EMAIL_FROM, Relay creates invitations and shows the link in-app instead of pretending the message was sent.',
        },
        { kind: 'h2', text: 'HTTPS and proxies' },
        {
          kind: 'p',
          text: 'Terminate TLS at your proxy and forward the original host so BASE_URL stays correct. The database connection should use TLS (sslmode=verify-full).',
        },
        { kind: 'h2', text: 'Backups and upgrades' },
        {
          kind: 'ul',
          items: [
            'Back up the PostgreSQL database; it holds all application state.',
            'To upgrade, pull the new code, run npm ci, npx prisma migrate deploy, then npm run build and restart.',
            'Migrations are forward-only; take a backup before applying them to production.',
          ],
        },
        { kind: 'h2', text: 'Serverless notes' },
        {
          kind: 'p',
          text: 'There is no worker and no filesystem dependency, so Relay deploys to serverless platforms. Keep job batches small; each invocation does a bounded amount of work.',
        },
      ],
    },

    configuration: {
      title: 'Configuration',
      lead: 'Every environment variable Relay reads.',
      blocks: [
        { kind: 'h2', text: 'Database' },
        {
          kind: 'ul',
          items: [
            'DATABASE_URL (required) — PostgreSQL connection string used by the driver adapter and the Prisma CLI.',
          ],
        },
        { kind: 'h2', text: 'Authentication' },
        {
          kind: 'ul',
          items: [
            'BASE_URL (required) — the public origin of the app.',
            'BETTER_AUTH_SECRET (required in production) — the auth signing secret.',
            'NEXT_PUBLIC_BASE_URL (optional) — exposes the API base URL to the browser; defaults to the current origin.',
          ],
        },
        { kind: 'h2', text: 'Jobs' },
        {
          kind: 'ul',
          items: [
            'CRON_SECRET (optional) — bearer secret for /api/jobs/*. Without it the endpoints return 503.',
          ],
        },
        { kind: 'h2', text: 'Email' },
        {
          kind: 'ul',
          items: [
            'RESEND_API_KEY and EMAIL_FROM (optional) — enable email delivery for invitations.',
          ],
        },
        { kind: 'h2', text: 'Seed' },
        {
          kind: 'ul',
          items: [
            'ROOT_EMAIL (required by seed) and ROOT_PASSWORD (required only when creating the account) — bootstrap the first administrator.',
            'SEED_DEMO_DATA (optional) — set to true to also create a sample workspace and workflow.',
          ],
        },
        { kind: 'h2', text: 'Outbound requests' },
        {
          kind: 'ul',
          items: [
            'OUTBOUND_ALLOWED_PORTS (optional) — comma-separated ports allowed for webhook delivery; defaults to 80,443,8080,8443.',
          ],
        },
      ],
    },

    workflows: {
      title: 'Workflows',
      lead: 'Design, validate, publish and run a process, and understand what happens at runtime.',
      blocks: [
        { kind: 'h2', text: 'Designing a workflow' },
        {
          kind: 'ul',
          items: [
            'A workflow is an ordered list of steps.',
            'A step is either a task (human work) or an approval (a decision).',
            'Steps may carry form fields, a required role and a due-in-days value.',
            'Conditional steps can be skipped based on values collected earlier in the run.',
          ],
        },
        { kind: 'h2', text: 'Publishing and versions' },
        {
          kind: 'p',
          text: 'A workflow starts as a draft. Publishing validates it and freezes an immutable version. Instances always reference the version they were started with, so editing the draft never changes running work.',
        },
        { kind: 'h2', text: 'Running an instance' },
        {
          kind: 'p',
          text: 'Starting an instance generates one task per non-skipped step. Tasks are released in order: the next task becomes available when the previous one completes (unless it is blocked by a dependency).',
        },
        { kind: 'h2', text: 'Task lifecycle' },
        {
          kind: 'ul',
          items: [
            'PENDING → CLAIMED → IN_PROGRESS → DONE, with CANCELLED and BLOCKED as terminal or waiting states.',
            'Approvals record a decision: APPROVED, REJECTED or CHANGES_REQUESTED.',
            'ANY mode resolves on the first decision; ALL mode requires every eligible approver.',
          ],
        },
        { kind: 'h2', text: 'Forms and conditions' },
        {
          kind: 'p',
          text: 'Form values are validated on the server against the step definition before a task can be completed. Collected values feed later step conditions.',
        },
      ],
    },

    automations: {
      title: 'Automations',
      lead: 'Rules that react to domain events, and the jobs that drive them.',
      blocks: [
        { kind: 'h2', text: 'Rules' },
        {
          kind: 'ul',
          items: [
            'A rule pairs a trigger (a domain event) with an action.',
            'Triggers: task.created, task.claimed, task.completed, task.decided, instance.started, instance.completed, workflow.published.',
            'Actions: notify_role, add_tag, set_priority, create_task.',
          ],
        },
        { kind: 'h2', text: 'Idempotency and reliability' },
        {
          kind: 'p',
          text: 'Each rule runs at most once per event. A run is claimed with a lease; the action and its status update commit in a single transaction, so a crash rolls both back and the lease is reclaimed.',
        },
        { kind: 'ul', items: [
          'Failed runs are retried with exponential backoff and jitter.',
          'After the attempt limit a run is dead-lettered and appears in the admin diagnostics, where it can be requeued.',
          'One failing rule never blocks the rest of the batch.',
        ] },
        { kind: 'h2', text: 'Jobs' },
        {
          kind: 'p',
          text: 'POST /api/jobs/drain fans out outbox events, delivers webhooks and retries automations. POST /api/jobs/sla-scan raises overdue and due-soon notifications. Both are idempotent and bounded.',
        },
      ],
    },

    integrations: {
      title: 'Integrations',
      lead: 'API keys, the REST API surface, and how to verify webhook signatures.',
      blocks: [
        { kind: 'h2', text: 'API keys' },
        {
          kind: 'ul',
          items: [
            'Create a key in Settings; the raw value is shown exactly once.',
            'Scopes: workflows:read, tasks:read, tasks:write, instances:read, instances:write.',
            'A key acts with the current role of the account that created it, so revoking access is immediate.',
          ],
        },
        { kind: 'h2', text: 'Endpoints' },
        {
          kind: 'ul',
          items: [
            'GET /api/v1/workflows — list workflows (workflows:read).',
            'POST /api/v1/workflows/{id}/run — start an instance (instances:write).',
            'GET /api/v1/instances — recent process runs (instances:read).',
            'GET /api/v1/tasks — paginated, filterable task list (tasks:read).',
            'GET /api/v1/tasks/{id} — a single task (tasks:read).',
            'POST /api/v1/tasks/{id}/claim — claim a free task (tasks:write).',
          ],
        },
        { kind: 'h2', text: 'Authentication' },
        {
          kind: 'code',
          language: 'bash',
          code: `curl https://your-host/api/v1/tasks?status=PENDING \\
  -H "Authorization: Bearer $RELAY_API_KEY"`,
        },
        { kind: 'h2', text: 'Verifying webhook signatures' },
        {
          kind: 'p',
          text: 'Each delivery carries x-relay-signature in the form t=<unix>,v1=<hex>. Compute HMAC-SHA256 over the string "<t>.<raw body>" using the endpoint secret and compare in constant time. Reject old timestamps to limit replay.',
        },
        {
          kind: 'code',
          language: 'javascript',
          code: `import { createHmac, timingSafeEqual } from 'node:crypto'

export function verify(secret, rawBody, header, toleranceSeconds = 300) {
  const [t, v1] = header.split(',').map((part) => part.split('=')[1])
  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranceSeconds) return false
  const expected = createHmac('sha256', secret).update(\`\${t}.\${rawBody}\`).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(v1 ?? '')
  return a.length === b.length && timingSafeEqual(a, b)
}`,
        },
        { kind: 'note', text: 'Delivery is at-least-once. Deduplicate using the x-relay-delivery header.' },
      ],
    },
  },

  changelog: [
    {
      version: 'Unreleased',
      date: '',
      items: [
        'Security hardening: no default seed credentials, bearer-only cron auth, SSRF resolve-then-check.',
        'Reliable outbox: atomic claims, leases, bounded retries, dead-letter and requeue.',
        'CSV exports are safe against formula injection; analytics isolate workflows and steps.',
        'English and Russian interface, documentation and API reference.',
        'The generated Prisma client is no longer committed; generation is reproducible.',
      ],
    },
    {
      version: '0.1.0',
      date: '2026-10',
      items: [
        'Workflow builder with forms, conditions and approvals.',
        'Versioned publishing and process instances.',
        'Atomic task pool, comments, activity, notifications and SLA automation.',
        'Organizations, roles, invitations, audit log, analytics, search and CSV export.',
        'Public API v1, scoped API keys and signed webhooks over a transactional outbox.',
      ],
    },
  ],

  legal: {
    privacy: {
      title: 'Privacy policy',
      lead: 'What a self-hosted Relay instance stores, and who is responsible for it.',
      draftNotice:
        'Draft for the operator to review. Relay is self-hosted: the operator of a given deployment is the data controller. Replace the bracketed placeholders before publishing. This is not legal advice.',
      blocks: [
        { kind: 'h2', text: 'Who controls your data' },
        {
          kind: 'p',
          text: 'Relay runs on infrastructure you choose. [Operator name] operates this instance and is the data controller.',
        },
        { kind: 'h2', text: 'What is stored' },
        {
          kind: 'ul',
          items: [
            'Account data: name, email address and a hashed password.',
            'Workspace data: organizations, memberships, workflows, process instances, tasks, comments and activity.',
            'Operational data: audit log entries, rate-limit counters and job run records.',
          ],
        },
        { kind: 'h2', text: 'Third parties' },
        {
          kind: 'p',
          text: 'Relay sends no data to the project maintainers. If the operator configures an email provider or an outbound webhook, the data needed for that feature is sent to the endpoint the operator configured.',
        },
        { kind: 'h2', text: 'Retention and your rights' },
        {
          kind: 'p',
          text: 'Data is retained for as long as the operator keeps the instance. Contact [contact details] to request access, correction or deletion.',
        },
      ],
    },
    terms: {
      title: 'Terms of use',
      lead: 'Terms for a self-hosted Relay instance.',
      draftNotice:
        'Draft for the operator to review. Relay is distributed under its own open-source licence; these terms govern the hosted instance your operator runs, and are not legal advice.',
      blocks: [
        { kind: 'h2', text: 'The service' },
        {
          kind: 'p',
          text: '[Operator name] provides access to this Relay instance. The instance is offered as-is, without a service-level guarantee unless separately agreed.',
        },
        { kind: 'h2', text: 'Acceptable use' },
        {
          kind: 'ul',
          items: [
            'Do not attempt to access data belonging to another organization.',
            'Do not use the instance to send unlawful or abusive outbound requests.',
            'Do not attempt to disrupt the instance or its users.',
          ],
        },
        { kind: 'h2', text: 'Accounts' },
        {
          kind: 'p',
          text: 'You are responsible for keeping your credentials secure and for activity performed with your account.',
        },
        { kind: 'h2', text: 'Changes' },
        {
          kind: 'p',
          text: 'These terms may change; continued use after a change means you accept the updated terms. The licence terms of the software itself are not affected.',
        },
      ],
    },
  },
}

const ru: SiteContent = {
  landing: {
    lifecycle: [
      {
        title: 'Опишите процесс',
        body: 'Добавьте шаги, выберите тип «задача» или «согласование», задайте формы и условия, затем проверьте черновик.',
      },
      {
        title: 'Опубликуйте версию',
        body: 'Публикация фиксирует неизменяемый снимок. Последующие правки не затрагивают уже запущенные экземпляры.',
      },
      {
        title: 'Запустите экземпляр',
        body: 'Запуск создаёт по задаче на каждый шаг и открывает их по очереди по мере продвижения процесса.',
      },
      {
        title: 'Завершите и проанализируйте',
        body: 'Задачи разбираются из пула, согласования решаются, а аналитика накапливает реальные данные о времени цикла и узких местах.',
      },
    ],
    work: [
      {
        title: 'Общий пул задач',
        body: 'Неназначенные задачи берутся одним атомарным обновлением: двое не смогут удерживать одну задачу.',
      },
      {
        title: 'Явные согласования',
        body: 'Решение «любой из» или «все из», варианты «нужны правки» и «отклонить», а также полный журнал решений.',
      },
      {
        title: 'Правила автоматизации',
        body: 'Реакция на события: уведомления и изменения задач. Каждое правило срабатывает не более одного раза на событие.',
      },
    ],
    api: [
      {
        title: 'API-ключи со scopes',
        body: 'Ключи хранятся только в виде хешей и несут явные права, например tasks:write или instances:read.',
      },
      {
        title: 'Версионированный REST API',
        body: 'Стабильный интерфейс /api/v1 с единым форматом ошибок, пагинацией и ограничениями частоты на ключ.',
      },
      {
        title: 'Подписанные webhook',
        body: 'Подписи HMAC-SHA256 с меткой времени, доставка через transactional outbox с повторными попытками.',
      },
    ],
    security: [
      {
        title: 'Изоляция организаций',
        body: 'Каждый запрос на сервере ограничен организацией пользователя; чужой идентификатор даёт «не найдено».',
      },
      {
        title: 'Роли проверяются на сервере',
        body: 'Права владельца, администратора и участника берутся из базы при каждом запросе.',
      },
      {
        title: 'Безопасные настройки по умолчанию',
        body: 'Нет администратора с известным паролем, нет секретов в URL, а исходящие запросы защищены от SSRF.',
      },
    ],
    developers: [
      {
        title: 'Понятные слои',
        body: 'Маршруты, модули функций, сервисный слой и общее ядро авторизации — у каждого своя роль.',
      },
      {
        title: 'Настоящие тесты',
        body: 'Модульные и интеграционные тесты покрывают авторизацию, конкурентность, повторы, аналитику и регрессии безопасности.',
      },
      {
        title: 'Типизация сквозная',
        body: 'TypeScript в строгом режиме, Zod на всех границах и Prisma-схема как источник истины.',
      },
    ],
    quickstartSteps: [
      { title: 'Установка', body: 'Клонируйте репозиторий и установите зависимости.' },
      { title: 'Настройка', body: 'Укажите адрес базы и секрет аутентификации в .env.' },
      { title: 'Миграции и запуск', body: 'Примените миграции, создайте первого администратора и запустите сервер.' },
    ],
    quickstartCode: `git clone https://github.com/kollakek1/Relay
cd Relay
npm install                 # также генерирует Prisma Client
cp .env.example .env        # укажите DATABASE_URL и BETTER_AUTH_SECRET

npm run db:deploy           # применить миграции
npm run db:seed             # первый администратор (ROOT_EMAIL + надёжный ROOT_PASSWORD)
npm run dev                 # http://localhost:3000`,
  },

  docs: {
    quickstart: {
      title: 'Быстрый старт',
      lead: 'От чистого клона до запущенного экземпляра процесса. Все команды соответствуют этому репозиторию.',
      blocks: [
        { kind: 'h2', text: 'Требования' },
        {
          kind: 'ul',
          items: [
            'Node.js 20 или новее (в CI используется Node 24).',
            'PostgreSQL 14 или новее, доступный с машины, где работает Relay.',
            'Другие внешние сервисы не требуются.',
          ],
        },
        { kind: 'h2', text: 'Установка и настройка' },
        {
          kind: 'code',
          language: 'bash',
          code: `git clone https://github.com/kollakek1/Relay
cd Relay
npm install

cp .env.example .env
# Откройте .env и задайте DATABASE_URL и BETTER_AUTH_SECRET.`,
        },
        {
          kind: 'note',
          text: 'Команда npm install автоматически запускает `prisma generate`. Сгенерированный клиент не хранится в репозитории — он собирается из prisma/schema.',
        },
        { kind: 'h2', text: 'Миграции и первый администратор' },
        {
          kind: 'code',
          language: 'bash',
          code: `npm run db:deploy   # применить миграции
ROOT_EMAIL=you@example.com ROOT_PASSWORD='надёжный-уникальный-пароль' npm run db:seed`,
        },
        {
          kind: 'note',
          text: 'Сид отказывается работать с отсутствующим, коротким или шаблонным паролем и никогда не печатает пароль. Установите SEED_DEMO_DATA=true, чтобы дополнительно создать демонстрационное пространство.',
        },
        { kind: 'h2', text: 'Запуск приложения' },
        { kind: 'code', language: 'bash', code: `npm run dev   # http://localhost:3000` },
        { kind: 'h2', text: 'Первый процесс' },
        {
          kind: 'ul',
          items: [
            'Войдите и откройте «Процессы», затем создайте процесс.',
            'Добавьте шаги; отметьте шаг как согласование, если нужно решение.',
            'Опубликуйте процесс — это зафиксирует версию 1.',
            'Откройте «Запуски» и создайте экземпляр.',
            'Возьмите задачу из пула и завершите её.',
          ],
        },
        { kind: 'h2', text: 'Частые проблемы' },
        {
          kind: 'ul',
          items: [
            '«DATABASE_URL environment variable is not set» — файл .env отсутствует или не загружен.',
            'Не удаётся подключиться к базе — проверьте хост, порт, учётные данные и режим TLS в DATABASE_URL.',
            'Сид прерван — задайте надёжный ROOT_PASSWORD и корректный ROOT_EMAIL.',
            'Ошибки типов после обновления — выполните npm run db:generate, чтобы обновить Prisma Client.',
          ],
        },
      ],
    },

    architecture: {
      title: 'Архитектура',
      lead: 'Как связаны слои и почему границы проведены именно так.',
      blocks: [
        { kind: 'h2', text: 'Слои' },
        {
          kind: 'ul',
          items: [
            'app/ — обработчики маршрутов, точки входа server actions и страницы.',
            'features/<домен>/ — схемы (Zod), серверные сервисы, actions и компоненты.',
            'shared/server/ — авторизация, ошибки, логирование, ограничение частоты, повторы и защита от SSRF.',
            'shared/components/ui/ — только презентационные примитивы.',
            'prisma/ — фрагменты схемы, миграции и сид.',
          ],
        },
        { kind: 'h2', text: 'Путь запроса' },
        {
          kind: 'p',
          text: 'Изменение приходит как server action. Он определяет контекст авторизации (пользователь, активная организация, роль), валидирует входные данные через Zod и вызывает сервис. Только сервис обращается к Prisma, и каждый запрос ограничен organizationId.',
        },
        { kind: 'h2', text: 'Авторизация' },
        {
          kind: 'p',
          text: 'Активное пространство хранится в cookie, но всегда перепроверяется по реальному членству. Роли образуют иерархию OWNER > ADMIN > MEMBER, определённую в одном месте (shared/server/permissions.ts).',
        },
        { kind: 'h2', text: 'Модель выполнения' },
        {
          kind: 'p',
          text: 'Публикация фиксирует неизменяемую версию. Экземпляры ссылаются на неё, поэтому правка черновика не влияет на запущенную работу. Задачи открываются пошагово и захватываются атомарно.',
        },
        { kind: 'h2', text: 'Фоновая работа без воркера' },
        {
          kind: 'p',
          text: 'В Relay нет постоянно работающего воркера. Доменные события записываются в transactional outbox в той же транзакции, что и изменение, а затем разбираются ограниченной задачей. События outbox, доставки webhook и запуски автоматизаций захватываются через SELECT … FOR UPDATE SKIP LOCKED с арендой, повторяются с экспоненциальной задержкой и джиттером и переводятся в dead-letter при исчерпании попыток.',
        },
      ],
    },

    security: {
      title: 'Безопасность',
      lead: 'Границы доверия, что контролируется сегодня и какие риски задокументированы как остаточные.',
      blocks: [
        { kind: 'h2', text: 'Границы доверия' },
        {
          kind: 'p',
          text: 'Браузер не является доверенным. Идентификаторы, роли и значения форм повторно определяются и проверяются на сервере. База данных — единственное доверенное хранилище; корректность не зависит от состояния в памяти.',
        },
        { kind: 'h2', text: 'Контролируемые механизмы' },
        {
          kind: 'ul',
          items: [
            'Изоляция организаций во всех чтениях и записях; для чужих идентификаторов — «не найдено».',
            'Проверка ролей в сервисном слое, а не на клиенте.',
            'Токены приглашений хранятся в виде хеша, имеют срок действия, одноразовы и должны совпадать с адресом приглашённого.',
            'API-ключи хранятся как SHA-256 хеши и несут scopes; они действуют с текущей ролью создателя.',
            'Доставка webhook подписана HMAC-SHA256 с меткой времени и выполняется минимум один раз.',
            'Ограничение частоты на основе базы данных защищает изменяющие эндпоинты.',
            'Cron-эндпоинты принимают только Authorization: Bearer с постоянным по времени сравнением; секреты не попадают в URL.',
            'Экспорт CSV нейтрализует формульные инъекции.',
            'Исходящие запросы защищены: список схем, запрет учётных данных, блокировка приватных и служебных адресов, проверка после разрешения имени, отказ от переходов по редиректам и ограничение размера ответа.',
          ],
        },
        { kind: 'h2', text: 'Секреты и конфигурация' },
        {
          kind: 'p',
          text: 'В production обязателен BETTER_AUTH_SECRET. CRON_SECRET защищает эндпоинты задач. Учётные данные администратора задаются только для первого запуска сида и никогда не имеют значений по умолчанию и не логируются.',
        },
        { kind: 'note', text: 'Полная таблица угроз и список остаточных рисков — в docs/THREAT_MODEL.md.' },
      ],
    },

    deployment: {
      title: 'Развёртывание',
      lead: 'Самостоятельный хостинг Relay на вашем PostgreSQL — от локальной машины до serverless-платформы.',
      blocks: [
        { kind: 'h2', text: 'Сборка и запуск' },
        {
          kind: 'code',
          language: 'bash',
          code: `npm ci
npx prisma migrate deploy   # применить миграции
npm run build
npm run start               # запуск production-сборки`,
        },
        { kind: 'h2', text: 'Обязательное окружение' },
        {
          kind: 'ul',
          items: [
            'DATABASE_URL — строка подключения к PostgreSQL.',
            'BASE_URL — публичный адрес, используется аутентификацией и ссылками-приглашениями.',
            'BETTER_AUTH_SECRET — длинный случайный секрет (openssl rand -base64 32).',
          ],
        },
        { kind: 'h2', text: 'Периодические задачи' },
        {
          kind: 'p',
          text: 'Вызывайте эндпоинты задач из любого планировщика: POST с заголовком Authorization: Bearer <CRON_SECRET>. Секрет никогда не принимается в строке запроса.',
        },
        {
          kind: 'code',
          language: 'bash',
          code: `# каждую минуту
curl -X POST https://your-host/api/jobs/drain -H "Authorization: Bearer $CRON_SECRET"
# каждый час
curl -X POST https://your-host/api/jobs/sla-scan -H "Authorization: Bearer $CRON_SECRET"`,
        },
        { kind: 'h2', text: 'Почта' },
        {
          kind: 'p',
          text: 'Почта необязательна. Без RESEND_API_KEY и EMAIL_FROM Relay создаёт приглашение и показывает ссылку прямо в интерфейсе, не выдавая отправку за успешную.',
        },
        { kind: 'h2', text: 'HTTPS и прокси' },
        {
          kind: 'p',
          text: 'Завершайте TLS на прокси и пробрасывайте исходный хост, чтобы BASE_URL оставался корректным. Подключение к базе стоит вести по TLS (sslmode=verify-full).',
        },
        { kind: 'h2', text: 'Резервные копии и обновления' },
        {
          kind: 'ul',
          items: [
            'Создавайте резервные копии базы PostgreSQL: в ней хранится всё состояние приложения.',
            'Для обновления получите новый код, выполните npm ci, затем npx prisma migrate deploy, npm run build и перезапуск.',
            'Миграции применяются только вперёд; перед применением в production сделайте резервную копию.',
          ],
        },
        { kind: 'h2', text: 'Serverless-особенности' },
        {
          kind: 'p',
          text: 'Воркера и зависимости от файловой системы нет, поэтому Relay разворачивается на serverless-платформах. Держите пакеты задач небольшими: каждый вызов выполняет ограниченный объём работы.',
        },
      ],
    },

    configuration: {
      title: 'Конфигурация',
      lead: 'Все переменные окружения, которые читает Relay.',
      blocks: [
        { kind: 'h2', text: 'База данных' },
        {
          kind: 'ul',
          items: [
            'DATABASE_URL (обязательна) — строка подключения к PostgreSQL для драйвер-адаптера и Prisma CLI.',
          ],
        },
        { kind: 'h2', text: 'Аутентификация' },
        {
          kind: 'ul',
          items: [
            'BASE_URL (обязательна) — публичный адрес приложения.',
            'BETTER_AUTH_SECRET (обязательна в production) — секрет подписи аутентификации.',
            'NEXT_PUBLIC_BASE_URL (необязательна) — передаёт базовый адрес API в браузер; по умолчанию текущий origin.',
          ],
        },
        { kind: 'h2', text: 'Задачи' },
        {
          kind: 'ul',
          items: [
            'CRON_SECRET (необязательна) — bearer-секрет для /api/jobs/*. Без него эндпоинты отвечают 503.',
          ],
        },
        { kind: 'h2', text: 'Почта' },
        {
          kind: 'ul',
          items: ['RESEND_API_KEY и EMAIL_FROM (необязательны) — включают отправку писем с приглашениями.'],
        },
        { kind: 'h2', text: 'Сид' },
        {
          kind: 'ul',
          items: [
            'ROOT_EMAIL (обязательна для сида) и ROOT_PASSWORD (нужна только при создании аккаунта) — первый администратор.',
            'SEED_DEMO_DATA (необязательна) — значение true дополнительно создаёт демонстрационное пространство и процесс.',
          ],
        },
        { kind: 'h2', text: 'Исходящие запросы' },
        {
          kind: 'ul',
          items: [
            'OUTBOUND_ALLOWED_PORTS (необязательна) — список портов для доставки webhook через запятую; по умолчанию 80,443,8080,8443.',
          ],
        },
      ],
    },

    workflows: {
      title: 'Процессы',
      lead: 'Проектирование, валидация, публикация и запуск процесса, а также что происходит во время выполнения.',
      blocks: [
        { kind: 'h2', text: 'Проектирование процесса' },
        {
          kind: 'ul',
          items: [
            'Процесс — упорядоченный список шагов.',
            'Шаг бывает задачей (работа человека) или согласованием (решение).',
            'У шага могут быть поля формы, требуемая роль и срок в днях.',
            'Условные шаги пропускаются на основе значений, собранных ранее в этом запуске.',
          ],
        },
        { kind: 'h2', text: 'Публикация и версии' },
        {
          kind: 'p',
          text: 'Процесс начинается как черновик. Публикация проверяет его и фиксирует неизменяемую версию. Экземпляры всегда ссылаются на версию, с которой запущены, поэтому правка черновика не меняет уже идущую работу.',
        },
        { kind: 'h2', text: 'Запуск экземпляра' },
        {
          kind: 'p',
          text: 'Запуск создаёт по задаче на каждый непропущенный шаг. Задачи открываются по порядку: следующая становится доступной после завершения предыдущей, если нет зависимости, которая её блокирует.',
        },
        { kind: 'h2', text: 'Жизненный цикл задачи' },
        {
          kind: 'ul',
          items: [
            'PENDING → CLAIMED → IN_PROGRESS → DONE; CANCELLED и BLOCKED — конечное и ожидающее состояния.',
            'Согласования фиксируют решение: APPROVED, REJECTED или CHANGES_REQUESTED.',
            'Режим ANY завершается по первому решению; ALL требует решения от каждого согласующего.',
          ],
        },
        { kind: 'h2', text: 'Формы и условия' },
        {
          kind: 'p',
          text: 'Значения форм проверяются на сервере по описанию шага до завершения задачи. Собранные значения используются в условиях последующих шагов.',
        },
      ],
    },

    automations: {
      title: 'Автоматизации',
      lead: 'Правила, реагирующие на события, и задачи, которые их обслуживают.',
      blocks: [
        { kind: 'h2', text: 'Правила' },
        {
          kind: 'ul',
          items: [
            'Правило связывает триггер (доменное событие) и действие.',
            'Триггеры: task.created, task.claimed, task.completed, task.decided, instance.started, instance.completed, workflow.published.',
            'Действия: notify_role, add_tag, set_priority, create_task.',
          ],
        },
        { kind: 'h2', text: 'Идемпотентность и надёжность' },
        {
          kind: 'p',
          text: 'Каждое правило срабатывает не более одного раза на событие. Запуск захватывается с арендой; действие и обновление статуса фиксируются одной транзакцией, поэтому при сбое откатываются оба, а аренда перехватывается заново.',
        },
        {
          kind: 'ul',
          items: [
            'Ошибочные запуски повторяются с экспоненциальной задержкой и джиттером.',
            'После исчерпания попыток запуск переводится в dead-letter и виден в диагностике администратора, откуда его можно перезапустить.',
            'Одно упавшее правило не блокирует остальные в пакете.',
          ],
        },
        { kind: 'h2', text: 'Задачи' },
        {
          kind: 'p',
          text: 'POST /api/jobs/drain разбирает события outbox, доставляет webhook и повторяет автоматизации. POST /api/jobs/sla-scan создаёт уведомления о просроченных и близких к сроку задачах. Оба идемпотентны и ограничены по объёму.',
        },
      ],
    },

    integrations: {
      title: 'Интеграции',
      lead: 'API-ключи, состав REST API и проверка подписей webhook.',
      blocks: [
        { kind: 'h2', text: 'API-ключи' },
        {
          kind: 'ul',
          items: [
            'Создайте ключ в настройках; само значение показывается ровно один раз.',
            'Scopes: workflows:read, tasks:read, tasks:write, instances:read, instances:write.',
            'Ключ действует с текущей ролью создавшего его аккаунта, поэтому отзыв доступа происходит сразу.',
          ],
        },
        { kind: 'h2', text: 'Эндпоинты' },
        {
          kind: 'ul',
          items: [
            'GET /api/v1/workflows — список процессов (workflows:read).',
            'POST /api/v1/workflows/{id}/run — запуск экземпляра (instances:write).',
            'GET /api/v1/instances — последние запуски (instances:read).',
            'GET /api/v1/tasks — постраничный список задач с фильтрами (tasks:read).',
            'GET /api/v1/tasks/{id} — одна задача (tasks:read).',
            'POST /api/v1/tasks/{id}/claim — взять свободную задачу (tasks:write).',
          ],
        },
        { kind: 'h2', text: 'Аутентификация' },
        {
          kind: 'code',
          language: 'bash',
          code: `curl https://your-host/api/v1/tasks?status=PENDING \\
  -H "Authorization: Bearer $RELAY_API_KEY"`,
        },
        { kind: 'h2', text: 'Проверка подписи webhook' },
        {
          kind: 'p',
          text: 'Каждая доставка содержит заголовок x-relay-signature вида t=<unix>,v1=<hex>. Вычислите HMAC-SHA256 по строке "<t>.<тело>" с секретом эндпоинта и сравните за постоянное время. Отклоняйте устаревшие метки времени, чтобы ограничить повторное воспроизведение.',
        },
        {
          kind: 'code',
          language: 'javascript',
          code: `import { createHmac, timingSafeEqual } from 'node:crypto'

export function verify(secret, rawBody, header, toleranceSeconds = 300) {
  const [t, v1] = header.split(',').map((part) => part.split('=')[1])
  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranceSeconds) return false
  const expected = createHmac('sha256', secret).update(\`\${t}.\${rawBody}\`).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(v1 ?? '')
  return a.length === b.length && timingSafeEqual(a, b)
}`,
        },
        { kind: 'note', text: 'Доставка выполняется минимум один раз. Дедупликацию делайте по заголовку x-relay-delivery.' },
      ],
    },
  },

  changelog: [
    {
      version: 'Unreleased',
      date: '',
      items: [
        'Усиление безопасности: нет учётных данных по умолчанию, cron только через bearer, SSRF с проверкой после разрешения имени.',
        'Надёжный outbox: атомарный захват, аренда, ограниченные повторы, dead-letter и перезапуск.',
        'Экспорт CSV защищён от формульных инъекций; аналитика изолирует процессы и шаги.',
        'Русский и английский интерфейс, документация и API-справочник.',
        'Сгенерированный Prisma Client больше не хранится в репозитории; генерация воспроизводима.',
      ],
    },
    {
      version: '0.1.0',
      date: '2026-10',
      items: [
        'Конструктор процессов с формами, условиями и согласованиями.',
        'Версионированная публикация и экземпляры процессов.',
        'Атомарный пул задач, комментарии, история, уведомления и автоматизация SLA.',
        'Организации, роли, приглашения, журнал аудита, аналитика, поиск и экспорт CSV.',
        'Публичный API v1, API-ключи со scopes и подписанные webhook через transactional outbox.',
      ],
    },
  ],

  legal: {
    privacy: {
      title: 'Политика конфиденциальности',
      lead: 'Какие данные хранит самостоятельно размещённый Relay и кто за них отвечает.',
      draftNotice:
        'Черновик для проверки оператором. Relay размещается самостоятельно: оператор конкретного развёртывания является контролёром данных. Замените фрагменты в квадратных скобках перед публикацией. Это не юридическая консультация.',
      blocks: [
        { kind: 'h2', text: 'Кто контролирует данные' },
        {
          kind: 'p',
          text: 'Relay работает на выбранной вами инфраструктуре. [Имя оператора] управляет этим инстансом и является контролёром данных.',
        },
        { kind: 'h2', text: 'Что хранится' },
        {
          kind: 'ul',
          items: [
            'Данные аккаунта: имя, адрес электронной почты и хеш пароля.',
            'Данные пространства: организации, членство, процессы, экземпляры, задачи, комментарии и история.',
            'Операционные данные: записи журнала аудита, счётчики ограничения частоты и записи о запусках задач.',
          ],
        },
        { kind: 'h2', text: 'Третьи стороны' },
        {
          kind: 'p',
          text: 'Relay не передаёт данные сопровождающим проекта. Если оператор настроил почтового провайдера или исходящий webhook, передаются только те данные, которые нужны для этой функции, и только на указанный оператором адрес.',
        },
        { kind: 'h2', text: 'Хранение и ваши права' },
        {
          kind: 'p',
          text: 'Данные хранятся столько, сколько их хранит оператор. Обратитесь по адресу [контакты], чтобы запросить доступ, исправление или удаление.',
        },
      ],
    },
    terms: {
      title: 'Условия использования',
      lead: 'Условия для самостоятельно размещённого инстанса Relay.',
      draftNotice:
        'Черновик для проверки оператором. Relay распространяется по собственной лицензии с открытым кодом; эти условия касаются инстанса, который запускает ваш оператор, и не являются юридической консультацией.',
      blocks: [
        { kind: 'h2', text: 'Сервис' },
        {
          kind: 'p',
          text: '[Имя оператора] предоставляет доступ к этому инстансу Relay. Инстанс предоставляется «как есть», без гарантий уровня сервиса, если иное не согласовано отдельно.',
        },
        { kind: 'h2', text: 'Допустимое использование' },
        {
          kind: 'ul',
          items: [
            'Не пытайтесь получить доступ к данным другой организации.',
            'Не используйте инстанс для противоправных или нежелательных исходящих запросов.',
            'Не пытайтесь нарушить работу инстанса или его пользователей.',
          ],
        },
        { kind: 'h2', text: 'Аккаунты' },
        {
          kind: 'p',
          text: 'Вы отвечаете за сохранность своих учётных данных и за действия, совершённые под вашим аккаунтом.',
        },
        { kind: 'h2', text: 'Изменения' },
        {
          kind: 'p',
          text: 'Условия могут меняться; дальнейшее использование после изменения означает принятие новой редакции. Лицензия на само программное обеспечение при этом не меняется.',
        },
      ],
    },
  },
}

export const CONTENT: Record<Locale, SiteContent> = { en, ru }

export function getContent(locale: Locale): SiteContent {
  return CONTENT[locale] ?? CONTENT[DEFAULT_LOCALE]
}

export const DOC_SLUGS: DocSlug[] = [
  'quickstart',
  'architecture',
  'security',
  'deployment',
  'configuration',
  'workflows',
  'automations',
  'integrations',
]

export function isDocSlug(value: string): value is DocSlug {
  return (DOC_SLUGS as readonly string[]).includes(value)
}
