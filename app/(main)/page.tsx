import Link from 'next/link'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { GridBackground } from '@/shared/components/decorative/gridBackground'
import {
  ArrowRightIcon,
  BookIcon,
  CheckCircle2Icon,
  GitBranchIcon,
  HandIcon,
  InboxIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  LockIcon,
  MailIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TimerIcon,
  WebhookIcon,
  WorkflowIcon,
} from 'lucide-react'

const REPO_URL = 'https://github.com/kollakek1/Relay'

const FEATURES = [
  {
    icon: WorkflowIcon,
    title: 'Visual workflow builder',
    body: 'Draft steps, set owners and due dates, and publish an immutable version your team runs against.',
  },
  {
    icon: GitBranchIcon,
    title: 'Conditions & forms',
    body: 'Capture structured input per step and skip steps automatically when a condition is not met.',
  },
  {
    icon: CheckCircle2Icon,
    title: 'Approvals',
    body: 'Approval steps with explicit “any approver” or “all approvers” rules, a decision log and notifications.',
  },
  {
    icon: InboxIcon,
    title: 'Atomic task pool',
    body: 'Claim work from a shared queue. A single conditional update guarantees two people never get one task.',
  },
  {
    icon: LayoutDashboardIcon,
    title: 'Dashboard & analytics',
    body: 'Live KPIs, cycle time, throughput and step bottlenecks computed from real data — no vanity metrics.',
  },
  {
    icon: TimerIcon,
    title: 'SLA automation',
    body: 'Idempotent cron-triggered scans raise overdue and due-soon notifications without any long-running worker.',
  },
  {
    icon: KeyRoundIcon,
    title: 'Public API & keys',
    body: 'Scoped API keys against a versioned JSON API with pagination, uniform errors and per-key limits.',
  },
  {
    icon: WebhookIcon,
    title: 'Signed webhooks',
    body: 'HMAC-signed deliveries for domain events, retried with backoff and a browsable delivery log.',
  },
  {
    icon: MailIcon,
    title: 'Invitations & workspaces',
    body: 'Invite by email with single-use expiring links, switch between workspaces, transfer ownership.',
  },
]

const STEPS = [
  {
    title: 'Create a workspace',
    body: 'Sign up and Relay provisions an organization with you as its owner.',
  },
  {
    title: 'Invite your team',
    body: 'Send hashed, single-use invite links and assign Owner, Admin or Member roles.',
  },
  {
    title: 'Design the process',
    body: 'Add steps, forms, conditions and approvals, then publish a version.',
  },
  {
    title: 'Run and improve',
    body: 'Start instances, claim tasks, watch analytics and wire up webhooks.',
  },
]

const GUARANTEES = [
  { icon: ShieldCheckIcon, text: 'Tenant isolation enforced on every server-side query' },
  { icon: LockIcon, text: 'Server-side authorization for every mutation — never the client' },
  { icon: RefreshCwIcon, text: 'Idempotent, bounded serverless jobs with retries and an outbox' },
  { icon: HandIcon, text: 'Concurrency-safe claims, approvals and assignments' },
]

export default function Home() {
  return (
    <main className="pt-16">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <GridBackground />
        <div className="container mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-20 text-center lg:py-28">
          <Badge variant="outline" className="gap-1">
            <SparklesIcon />
            Open-source workflow engine
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight lg:text-6xl">
            Orchestrate your business, <span className="text-primary">on your terms</span>.
          </h1>
          <p className="text-muted-foreground lg:text-xl">
            Relay moves work through strictly defined pipelines: build a process, publish a version,
            run instances and let tasks flow through a shared pool — with roles, approvals, SLA
            reminders and a real API.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button size="xl" asChild>
              <Link href="/dashboard">
                Start free <ArrowRightIcon />
              </Link>
            </Button>
            <Button size="xl" variant="secondary" asChild>
              <Link href={`${REPO_URL}#readme`} target="_blank" rel="noreferrer">
                Read the docs <BookIcon />
              </Link>
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">
            Self-hosted · PostgreSQL · runs on serverless · no proprietary services required
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="border-border border-y">
        <div className="container mx-auto max-w-6xl px-4 py-16 lg:py-20">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-2xl font-bold lg:text-3xl">Everything a team needs to run work</h2>
            <p className="text-muted-foreground mt-2">
              Built on the pieces that usually stay “MVP-shaped”: authorization, concurrency and
              reliability are done for real.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="bg-card/50">
                <CardContent className="space-y-2">
                  <div className="text-primary flex items-center gap-2">
                    <feature.icon className="size-4" />
                    <h3 className="font-semibold">{feature.title}</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">{feature.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container mx-auto max-w-6xl px-4 py-16 lg:py-20">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="text-2xl font-bold lg:text-3xl">From zero to a running process</h2>
        </div>
        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="space-y-2">
              <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full text-sm font-semibold">
                {index + 1}
              </div>
              <h3 className="font-semibold">{step.title}</h3>
              <p className="text-muted-foreground text-sm">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Guarantees */}
      <section className="border-border border-y">
        <div className="container mx-auto grid max-w-6xl gap-8 px-4 py-16 lg:grid-cols-2 lg:py-20">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold lg:text-3xl">Engineered to be trusted</h2>
            <p className="text-muted-foreground">
              Relay keeps a single PostgreSQL database and no long-running workers, so it deploys to
              any serverless platform. Correctness lives in the database and the server logic.
            </p>
            <ul className="space-y-3">
              {GUARANTEES.map((item) => (
                <li key={item.text} className="flex items-start gap-3 text-sm">
                  <item.icon className="text-primary mt-0.5 size-4 shrink-0" />
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <Card className="bg-card/50">
            <CardContent className="space-y-4">
              <h3 className="font-semibold">Get an API key in seconds</h3>
              <pre className="bg-muted/50 overflow-x-auto rounded-lg p-4 text-xs leading-relaxed">
                <code>{`# claim a task from the pool
curl -X POST https://your-relay/api/v1/tasks/$TASK/claim \\
  -H "Authorization: Bearer $RELAY_API_KEY"

# start a process instance
curl -X POST https://your-relay/api/v1/workflows/$WF/run \\
  -H "Authorization: Bearer $RELAY_API_KEY"`}</code>
              </pre>
              <p className="text-muted-foreground text-sm">
                Keys are hashed at rest, scoped per capability, and act with the current role of the
                account that created them.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto max-w-3xl px-4 py-20 text-center">
        <h2 className="text-3xl font-bold lg:text-4xl">Ready to run your first process?</h2>
        <p className="text-muted-foreground mt-3">
          Spin Relay up locally with PostgreSQL, or point it at your own database.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button size="xl" asChild>
            <Link href="/dashboard">
              Open the app <ArrowRightIcon />
            </Link>
          </Button>
          <Button size="xl" variant="outline" asChild>
            <Link href={`${REPO_URL}`} target="_blank" rel="noreferrer">
              Star on GitHub
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-border text-muted-foreground border-t py-8 text-center text-sm">
        <div className="container mx-auto px-4">
          <p>Relay — open-source workflow engine.</p>
          <p className="mt-1">Built with Next.js, Prisma, Better Auth and shadcn/ui.</p>
        </div>
      </footer>
    </main>
  )
}
