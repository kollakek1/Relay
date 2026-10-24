'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { WorkflowStatus } from '@/prisma/generated/prisma/enums'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { EmptyState } from '@/shared/components/empty-state'
import { createWorkflowAction } from '@/features/workflow/actions'
import { useAction } from '@/shared/hooks/useAction'
import { useT } from '@/shared/i18n/provider'
import type { MessageKey } from '@/shared/i18n/translate'
import { formatDate } from '@/shared/lib/format'
import { Loader2Icon, PlusIcon, SearchIcon, WorkflowIcon } from 'lucide-react'

export interface WorkflowListItemView {
  id: string
  name: string
  description: string | null
  status: WorkflowStatus
  updatedAt: Date | string
  _count: { steps: number; versions: number; instances: number }
}

const STATUS_VARIANT: Record<WorkflowStatus, 'default' | 'secondary' | 'outline'> = {
  DRAFT: 'outline',
  PUBLISHED: 'default',
  ARCHIVED: 'secondary',
}

export function WorkflowsView({
  workflows,
  canManage,
  initialQuery,
}: {
  workflows: WorkflowListItemView[]
  canManage: boolean
  initialQuery: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const t = useT()
  const { isPending, run } = useAction()
  const [isSearching, startSearch] = useTransition()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [query, setQuery] = useState(initialQuery)

  // Debounce the search box into the URL so filtering happens live.
  useEffect(() => {
    const current = searchParams.get('q') ?? ''
    if (query === current) return
    const timer = setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString())
      if (query.trim()) next.set('q', query.trim())
      else next.delete('q')
      startSearch(() => router.push(`${pathname}?${next.toString()}`))
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const createWorkflow = () => {
    run(() => createWorkflowAction({ name, description }), {
      success: t('workflowList.created'),
      onSuccess: (data) => {
        setOpen(false)
        setName('')
        setDescription('')
        router.push(`/dashboard/workflows/${data.id}`)
      },
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            id="workflow-search"
            name="q"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('filters.searchWorkflows')}
            className="pl-9"
            aria-label={t('filters.searchWorkflows')}
          />
          {isSearching && (
            <Loader2Icon className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />
          )}
        </div>

        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusIcon />
                {t('workflowList.new')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('workflowList.new')}</DialogTitle>
                <DialogDescription>{t('workflowList.newDescription')}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="workflow-name">{t('workflowList.name')}</Label>
                  <Input
                    id="workflow-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t('workflowList.namePlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workflow-description">{t('workflowList.description')}</Label>
                  <Textarea
                    id="workflow-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder={t('workflowList.descriptionPlaceholder')}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={createWorkflow} disabled={isPending || name.trim().length < 2}>
                  {isPending && <Loader2Icon className="animate-spin" />}
                  {t('workflowList.createDraft')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {workflows.length === 0 ? (
        <EmptyState
          icon={WorkflowIcon}
          title={initialQuery ? t('workflowList.emptySearchTitle') : t('workflowList.emptyTitle')}
          description={
            initialQuery
              ? t('workflowList.emptySearchBody')
              : canManage
                ? t('workflowList.emptyBodyManage')
                : t('workflowList.emptyBodyReadonly')
          }
        />
      ) : (
        <div className="border-border bg-card overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.name')}</TableHead>
                <TableHead>{t('table.status')}</TableHead>
                <TableHead>{t('table.steps')}</TableHead>
                <TableHead>{t('table.versions')}</TableHead>
                <TableHead>{t('table.runs')}</TableHead>
                <TableHead>{t('table.updated')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflows.map((workflow) => (
                <TableRow key={workflow.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/workflows/${workflow.id}`}
                      className="font-medium hover:underline"
                    >
                      {workflow.name}
                    </Link>
                    {workflow.description && (
                      <p className="text-muted-foreground line-clamp-1 max-w-md text-xs">
                        {workflow.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[workflow.status]}>
                      {t(`status.${workflow.status}` as MessageKey)}
                    </Badge>
                  </TableCell>
                  <TableCell>{workflow._count.steps}</TableCell>
                  <TableCell>{workflow._count.versions}</TableCell>
                  <TableCell>{workflow._count.instances}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(workflow.updatedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
