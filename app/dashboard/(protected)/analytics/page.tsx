import Link from 'next/link'
import { requireContext } from '@/shared/server/auth-context'
import { getAnalytics } from '@/features/analytics/server/service'
import { PageHeader } from '@/shared/components/page-header'
import { EmptyState } from '@/shared/components/empty-state'
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table'
import { formatDuration, formatPercent } from '@/shared/lib/format'
import { BarChart3Icon } from 'lucide-react'

export default async function AnalyticsPage() {
  const ctx = await requireContext()
  const analytics = await getAnalytics(ctx)
  const { overview, workflows, bottlenecks } = analytics

  const cards = [
    { label: 'Total runs', value: overview.instances.total },
    { label: 'Running', value: overview.instances.running },
    { label: 'Completed', value: overview.instances.completed },
    { label: 'Cancelled', value: overview.instances.cancelled },
    { label: 'Open tasks', value: overview.tasks.open },
    { label: 'Done tasks', value: overview.tasks.done },
    { label: 'Overdue tasks', value: overview.tasks.overdue },
    { label: 'Avg cycle time', value: formatDuration(overview.cycleTimeMs.avg) },
    { label: 'Median cycle time', value: formatDuration(overview.cycleTimeMs.median) },
    { label: 'Overdue rate', value: formatPercent(overview.tasks.overdueRate) },
  ]

  const hasData = overview.instances.total > 0 || overview.tasks.total > 0

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 lg:p-10">
      <PageHeader
        title="Analytics"
        description="Throughput, cycle time and bottlenecks for this workspace."
      />

      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="space-y-1">
              <p className="text-muted-foreground text-sm">{card.label}</p>
              <p className="text-foreground text-2xl font-bold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {!hasData ? (
        <EmptyState
          icon={BarChart3Icon}
          title="No process data yet"
          description="Publish and run a workflow to start collecting metrics."
        />
      ) : (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">By workflow</h2>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Workflow</TableHead>
                    <TableHead>Runs</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Avg cycle</TableHead>
                    <TableHead>Overdue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workflows.map((workflow) => (
                    <TableRow key={workflow.workflowId}>
                      <TableCell>
                        <Link
                          href={`/dashboard/workflows/${workflow.workflowId}`}
                          className="font-medium hover:underline"
                        >
                          {workflow.workflowName}
                        </Link>
                      </TableCell>
                      <TableCell>{workflow.instances}</TableCell>
                      <TableCell>{workflow.completed}</TableCell>
                      <TableCell>{formatDuration(workflow.avgCycleTimeMs)}</TableCell>
                      <TableCell>{formatPercent(workflow.overdueRate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Step bottlenecks</h2>
            </CardHeader>
            <CardContent>
              {bottlenecks.length === 0 ? (
                <p className="text-muted-foreground text-sm">No completed tasks yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Step</TableHead>
                      <TableHead>Samples</TableHead>
                      <TableHead>Avg duration</TableHead>
                      <TableHead>Overdue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bottlenecks.map((step) => (
                      <TableRow key={`${step.workflowId}:${step.stepOrder}`}>
                        <TableCell className="font-medium">
                          #{step.stepOrder} {step.stepName}
                          <span className="text-muted-foreground ml-2 text-xs">
                            {step.workflowName}
                          </span>
                        </TableCell>
                        <TableCell>{step.samples}</TableCell>
                        <TableCell>{formatDuration(step.avgDurationMs)}</TableCell>
                        <TableCell>{formatPercent(step.overdueRate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  )
}
