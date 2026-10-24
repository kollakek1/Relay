import Link from 'next/link'
import { requireContext } from '@/shared/server/auth-context'
import { getCurrentUser } from '@/shared/server/auth-context'
import { getDashboard } from '@/features/dashboard/server/service'
import { TaskStatusBadge } from '@/features/task/components/task-badges'
import { PageHeader } from '@/shared/components/page-header'
import { EmptyState } from '@/shared/components/empty-state'
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card'
import { cn } from '@/shared/lib/utils'
import { formatDate, formatRelativeTime, isOverdue } from '@/shared/lib/format'
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  ClockIcon,
  InboxIcon,
  ListChecksIcon,
} from 'lucide-react'

const ACTIVITY_TEXT: Record<string, string> = {
  CREATED: 'created',
  CLAIMED: 'claimed',
  ASSIGNED: 'was assigned',
  UNASSIGNED: 'was unassigned',
  STATUS_CHANGED: 'changed status of',
  DUE_CHANGED: 'changed the due date of',
  COMMENTED: 'commented on',
}

export default async function DashboardPage() {
  const ctx = await requireContext()
  const [user, data] = await Promise.all([getCurrentUser(), getDashboard(ctx)])
  const { stats, myOpenTasks, recentActivity } = data

  const cards = [
    { label: 'My tasks', value: stats.myTasks, icon: ListChecksIcon, href: '/dashboard/tasks?assignee=me' },
    { label: 'Available in pool', value: stats.pendingPool, icon: InboxIcon, href: '/dashboard/pool' },
    { label: 'Completed today', value: stats.completedToday, icon: CheckCircle2Icon, href: '/dashboard/tasks?assignee=me&status=DONE' },
    { label: 'Active instances', value: stats.activeInstances, icon: ClockIcon, href: '/dashboard/instances' },
    { label: 'Overdue', value: stats.overdue, icon: AlertTriangleIcon, href: '/dashboard/tasks?assignee=me' },
  ]

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 lg:p-10">
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0] ?? 'there'}`}
        description="Here is what is happening across your workspace."
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {cards.map((card) => (
          <Link key={card.label} href={card.href}>
            <Card className="hover:border-primary/40 h-full transition-colors">
              <CardContent className="space-y-2">
                <div className="text-muted-foreground flex items-center gap-2">
                  <card.icon className="size-4" />
                  <span className="text-sm">{card.label}</span>
                </div>
                <p className="text-foreground text-3xl font-bold">{card.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <h2 className="text-lg font-semibold">My open tasks</h2>
            <Link
              href="/dashboard/tasks?assignee=me"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
            >
              View all <ArrowRightIcon className="size-4" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {myOpenTasks.length === 0 ? (
              <EmptyState
                icon={ListChecksIcon}
                title="No open tasks"
                description="Claim a task from the pool to get started."
                className="py-8"
              />
            ) : (
              myOpenTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/dashboard/tasks/${task.id}`}
                  className="border-border bg-background hover:bg-muted/50 flex items-center justify-between rounded-lg border p-4 transition-colors"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{task.name}</p>
                    <p className="text-muted-foreground text-sm">
                      {task.instance.workflow?.name ?? 'Workflow'}
                      {task.dueAt && (
                        <span
                          className={cn(
                            'ml-2',
                            isOverdue(task.dueAt) && 'text-destructive font-medium'
                          )}
                        >
                          Due {formatDate(task.dueAt)}
                        </span>
                      )}
                    </p>
                  </div>
                  <TaskStatusBadge status={task.status} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="max-h-min">
          <CardHeader>
            <h2 className="text-lg font-semibold">Recent activity</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActivity.length === 0 ? (
              <p className="text-muted-foreground text-sm">No activity yet.</p>
            ) : (
              recentActivity.map((event) => (
                <div key={event.id} className="flex gap-3">
                  <div className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" />
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm">
                      <span className="font-medium">{event.actor?.name ?? 'System'}</span>{' '}
                      <span className="text-muted-foreground">
                        {ACTIVITY_TEXT[event.type] ?? 'updated'}{' '}
                      </span>
                      <Link
                        href={`/dashboard/tasks/${event.task.id}`}
                        className="font-medium hover:underline"
                      >
                        {event.task.name}
                      </Link>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatRelativeTime(event.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
