import Link from 'next/link'
import { requireAreaAccess } from '@/shared/server/auth-context'
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
import { getTranslator } from '@/shared/i18n/server'
import { BarChart3Icon } from 'lucide-react'

export default async function AnalyticsPage() {
  const ctx = await requireAreaAccess('analytics')
  const { t } = await getTranslator()
  const analytics = await getAnalytics(ctx)
  const { overview, workflows, bottlenecks } = analytics

  const cards = [
    { label: t('analytics.totalRuns'), value: overview.instances.total },
    { label: t('analytics.running'), value: overview.instances.running },
    { label: t('analytics.completed'), value: overview.instances.completed },
    { label: t('analytics.cancelled'), value: overview.instances.cancelled },
    { label: t('analytics.openTasks'), value: overview.tasks.open },
    { label: t('analytics.doneTasks'), value: overview.tasks.done },
    { label: t('analytics.overdueTasks'), value: overview.tasks.overdue },
    { label: t('analytics.avgCycleTime'), value: formatDuration(overview.cycleTimeMs.avg) },
    { label: t('analytics.medianCycleTime'), value: formatDuration(overview.cycleTimeMs.median) },
    { label: t('analytics.overdueRate'), value: formatPercent(overview.tasks.overdueRate) },
  ]

  const hasData = overview.instances.total > 0 || overview.tasks.total > 0

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 lg:p-10">
      <PageHeader title={t('pages.analyticsTitle')} description={t('pages.analyticsDescription')} />

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
          title={t('pages.noProcessData')}
          description={t('pages.noProcessDataBody')}
        />
      ) : (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">{t('analytics.byWorkflow')}</h2>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('table.workflow')}</TableHead>
                    <TableHead>{t('analytics.runsColumn')}</TableHead>
                    <TableHead>{t('analytics.completedColumn')}</TableHead>
                    <TableHead>{t('analytics.avgCycleColumn')}</TableHead>
                    <TableHead>{t('analytics.overdueColumn')}</TableHead>
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
              <h2 className="text-lg font-semibold">{t('analytics.stepBottlenecks')}</h2>
            </CardHeader>
            <CardContent>
              {bottlenecks.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t('analytics.noCompletedTasks')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('analytics.stepColumn')}</TableHead>
                      <TableHead>{t('analytics.samplesColumn')}</TableHead>
                      <TableHead>{t('analytics.avgDurationColumn')}</TableHead>
                      <TableHead>{t('analytics.overdueColumn')}</TableHead>
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
