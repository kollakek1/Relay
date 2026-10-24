'use client'

import { useRouter } from 'next/navigation'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { useAction } from '@/shared/hooks/useAction'
import { formatDateTime } from '@/shared/lib/format'
import { createDraftFromVersionAction } from '@/features/workflow/actions'
import { RotateCcwIcon } from 'lucide-react'

export interface VersionRow {
  id: string
  version: number
  publishedAt: Date | string
  publishedByName: string
  instances: number
}

export interface VersionDiffRow {
  order: number
  name: string
  status: 'added' | 'removed' | 'changed' | 'same'
  changes: string[]
}

const STATUS_VARIANT: Record<VersionDiffRow['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  added: 'default',
  removed: 'destructive',
  changed: 'secondary',
  same: 'outline',
}

export function VersionHistory({
  workflowId,
  versions,
  diff,
  canManage,
}: {
  workflowId: string
  versions: VersionRow[]
  diff: { from: number; to: number; diffs: VersionDiffRow[] } | null
  canManage: boolean
}) {
  const router = useRouter()
  const { isPending, run } = useAction()

  const restore = (version: number) =>
    run(() => createDraftFromVersionAction({ workflowId, version }), {
      success: `Draft replaced with v${version}`,
      onSuccess: () => router.refresh(),
    })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Version history</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {versions.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No published versions yet. Publish the workflow to create v1.
          </p>
        ) : (
          <div className="divide-border border-border divide-y rounded-lg border">
            {versions.map((version, index) => (
              <div key={version.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                <span className="font-medium">v{version.version}</span>
                {index === 0 && <Badge variant="secondary">Latest</Badge>}
                <span className="text-muted-foreground">
                  {formatDateTime(version.publishedAt)} · {version.publishedByName} · {version.instances}{' '}
                  run{version.instances === 1 ? '' : 's'}
                </span>
                {canManage && (
                  <Button
                    variant="outline"
                    size="xs"
                    className="ml-auto"
                    disabled={isPending}
                    onClick={() => restore(version.version)}
                  >
                    <RotateCcwIcon />
                    Draft from v{version.version}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {diff && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium">
              Changes v{diff.from} → v{diff.to}
            </h3>
            <div className="space-y-2">
              {diff.diffs.map((entry) => (
                <div
                  key={entry.order}
                  className="border-border flex flex-wrap items-start gap-2 rounded-md border p-2 text-xs"
                >
                  <Badge variant={STATUS_VARIANT[entry.status]}>{entry.status}</Badge>
                  <span className="font-medium">
                    #{entry.order} {entry.name}
                  </span>
                  {entry.changes.length > 0 && (
                    <ul className="text-muted-foreground w-full list-disc pl-4">
                      {entry.changes.map((change) => (
                        <li key={change} className="break-words">
                          {change}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
