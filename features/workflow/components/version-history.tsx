'use client'

import { useRouter } from 'next/navigation'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { useAction } from '@/shared/hooks/useAction'
import { useT } from '@/shared/i18n/provider'
import type { MessageKey } from '@/shared/i18n/translate'
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

const DIFF_STATUS_KEY: Record<VersionDiffRow['status'], MessageKey> = {
  added: 'versions.added',
  removed: 'versions.removed',
  changed: 'versions.changed',
  same: 'versions.same',
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
  const t = useT()
  const { isPending, run } = useAction()

  const restore = (version: number) =>
    run(() => createDraftFromVersionAction({ workflowId, version }), {
      success: t('versions.restored', { version }),
      onSuccess: () => router.refresh(),
    })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('versions.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {versions.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('versions.empty')}</p>
        ) : (
          <div className="divide-border border-border divide-y rounded-lg border">
            {versions.map((version, index) => (
              <div key={version.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                <span className="font-medium">v{version.version}</span>
                {index === 0 && <Badge variant="secondary">{t('versions.latest')}</Badge>}
                <span className="text-muted-foreground">
                  {formatDateTime(version.publishedAt)} · {version.publishedByName} ·{' '}
                  {t('versions.runCount', { count: version.instances })}
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
                    {t('versions.draftFrom', { version: version.version })}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {diff && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium">
              {t('versions.changes', { from: diff.from, to: diff.to })}
            </h3>
            <div className="space-y-2">
              {diff.diffs.map((entry) => (
                <div
                  key={entry.order}
                  className="border-border flex flex-wrap items-start gap-2 rounded-md border p-2 text-xs"
                >
                  <Badge variant={STATUS_VARIANT[entry.status]}>{t(DIFF_STATUS_KEY[entry.status])}</Badge>
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
