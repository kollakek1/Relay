import { requireAreaAccess } from '@/shared/server/auth-context'
import { can } from '@/shared/server/permissions'
import { listArchivedInstances } from '@/features/workflow/server/service'
import { PageHeader } from '@/shared/components/page-header'
import { EmptyState } from '@/shared/components/empty-state'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { RestoreInstanceButton } from '@/features/workflow/components/archive-actions'
import { formatDateTime } from '@/shared/lib/format'
import { getTranslator } from '@/shared/i18n/server'
import { ArchiveIcon } from 'lucide-react'

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const ctx = await requireAreaAccess('archive')
  const { t } = await getTranslator()
  const { q, status } = await searchParams
  const statusFilter = status === 'COMPLETED' || status === 'CANCELLED' ? status : undefined
  const instances = await listArchivedInstances(ctx, { search: q, status: statusFilter })
  const canRestore = can(ctx, 'workflow.delete')

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 lg:p-10">
      <PageHeader title={t('archive.title')} description={t('archive.description')} />

      <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          type="search"
          name="q"
          defaultValue={q ?? ''}
          placeholder={t('archive.searchPlaceholder')}
          aria-label={t('archive.searchPlaceholder')}
          className="sm:max-w-xs"
        />
        <select
          name="status"
          defaultValue={statusFilter ?? ''}
          aria-label={t('archive.filterStatus')}
          className="border-border bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option value="">{t('archive.allStatuses')}</option>
          <option value="COMPLETED">{t('status.COMPLETED')}</option>
          <option value="CANCELLED">{t('status.CANCELLED')}</option>
        </select>
        <Button type="submit" variant="outline" size="sm">
          {t('common.search')}
        </Button>
      </form>

      {!canRestore && (
        <p className="text-muted-foreground text-sm">{t('archive.readOnly')}</p>
      )}

      {instances.length === 0 ? (
        <EmptyState
          icon={ArchiveIcon}
          title={q ? t('archive.searchEmptyTitle') : t('archive.emptyTitle')}
          description={q ? t('archive.searchEmptyBody') : t('archive.emptyBody')}
        />
      ) : (
        <div className="border-border bg-card overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.workflow')}</TableHead>
                <TableHead>{t('table.version')}</TableHead>
                <TableHead>{t('table.status')}</TableHead>
                <TableHead>{t('archive.archivedAt')}</TableHead>
                <TableHead>{t('archive.archivedBy')}</TableHead>
                {canRestore && <TableHead className="text-right">{t('archive.columns')}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {instances.map((instance) => (
                <TableRow key={instance.id}>
                  <TableCell className="font-medium">{instance.workflow.name}</TableCell>
                  <TableCell>v{instance.version.version}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{instance.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {instance.archivedAt ? formatDateTime(instance.archivedAt) : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {instance.archivedBy?.name ?? '—'}
                  </TableCell>
                  {canRestore && (
                    <TableCell className="text-right">
                      <RestoreInstanceButton
                        instanceId={instance.id}
                        name={instance.workflow.name}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  )
}
