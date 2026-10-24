import { requireContext } from '@/shared/server/auth-context'
import { listInstances } from '@/features/workflow/server/service'
import { PageHeader } from '@/shared/components/page-header'
import { EmptyState } from '@/shared/components/empty-state'
import { Badge } from '@/shared/components/ui/badge'
import { Progress } from '@/shared/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { formatDateTime } from '@/shared/lib/format'
import { BoxesIcon } from 'lucide-react'

const STATUS_VARIANT = {
  RUNNING: 'default',
  COMPLETED: 'secondary',
  CANCELLED: 'outline',
} as const

export default async function InstancesPage() {
  const ctx = await requireContext()
  const instances = await listInstances(ctx)

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 lg:p-10">
      <PageHeader title="Process instances" description="Every run of a published workflow." />

      {instances.length === 0 ? (
        <EmptyState
          icon={BoxesIcon}
          title="No process instances"
          description="Publish a workflow and start an instance to see runs here."
        />
      ) : (
        <div className="border-border bg-card overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workflow</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Started by</TableHead>
                <TableHead>Started</TableHead>
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
