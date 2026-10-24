import { requireContext } from '@/shared/server/auth-context'
import { listInstances } from '@/features/workflow/server/service'
import { PageHeader } from '@/shared/components/page-header'
import { EmptyState } from '@/shared/components/empty-state'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Progress } from '@/shared/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { formatDateTime } from '@/shared/lib/format'
import { getTranslator } from '@/shared/i18n/server'
import { BoxesIcon, DownloadIcon } from 'lucide-react'

const STATUS_VARIANT = {
  RUNNING: 'default',
  COMPLETED: 'secondary',
  CANCELLED: 'outline',
} as const

export default async function InstancesPage() {
  const ctx = await requireContext()
  const { t } = await getTranslator()
  const instances = await listInstances(ctx)

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 lg:p-10">
      <PageHeader
        title={t('pages.runsTitle')}
        description={t('pages.runsDescription')}
        actions={
          <Button variant="outline" size="sm" asChild>
            <a href="/api/export?kind=instances" download>
              <DownloadIcon />
              {t('pages.exportCsv')}
            </a>
          </Button>
        }
      />

      {instances.length === 0 ? (
        <EmptyState
          icon={BoxesIcon}
          title={t('pages.runsEmptyTitle')}
          description={t('pages.runsEmptyBody')}
        />
      ) : (
        <div className="border-border bg-card overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.workflow')}</TableHead>
                <TableHead>{t('table.version')}</TableHead>
                <TableHead>{t('table.status')}</TableHead>
                <TableHead>{t('table.progress')}</TableHead>
                <TableHead>{t('table.startedBy')}</TableHead>
                <TableHead>{t('table.started')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instances.map((instance) => {
                const total = instance._count.tasks
                const done = instance.tasks.length
                return (
                  <TableRow key={instance.id}>
                    <TableCell className="font-medium">{instance.workflow.name}</TableCell>
                    <TableCell>v{instance.version.version}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[instance.status]}>{instance.status}</Badge>
                    </TableCell>
                    <TableCell className="min-w-40">
                      <div className="flex items-center gap-2">
                        <Progress value={total ? (done / total) * 100 : 0} className="w-24" />
                        <span className="text-muted-foreground text-xs">
                          {done}/{total}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{instance.startedBy.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(instance.startedAt)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  )
}
