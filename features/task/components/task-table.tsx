'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { TaskPriority, TaskStatus } from '@/prisma/generated/prisma/enums'
import { Button } from '@/shared/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { useAction } from '@/shared/hooks/useAction'
import { formatDate, isOverdue } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { claimTaskAction } from '@/features/task/actions'
import { TaskPriorityBadge, TaskStatusBadge } from './task-badges'
import { HandIcon, Loader2Icon } from 'lucide-react'

export interface TaskRow {
  id: string
  name: string
  status: TaskStatus
  priority: TaskPriority
  dueAt: Date | string | null
  assignee: { id: string; name: string; image: string | null } | null
  instance: { id: string; workflow: { id: string; name: string } | null } | null
}

export function TaskTable({
  tasks,
  total,
  page,
  pageSize,
  showClaim = false,
}: {
  tasks: TaskRow[]
  total: number
  page: number
  pageSize: number
  showClaim?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const { isPending, run } = useAction()

  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  const goToPage = (next: number) => {
    const query = new URLSearchParams(params.toString())
    query.set('page', String(next))
    router.push(`${pathname}?${query.toString()}`)
  }

  const claim = (taskId: string) =>
    run(() => claimTaskAction({ taskId }), {
      success: 'Task claimed',
      onSuccess: () => router.refresh(),
    })

  return (
    <div className="space-y-4">
      <div className="border-border bg-card overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Due</TableHead>
              {showClaim && <TableHead className="w-28" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TableRow key={task.id}>
                <TableCell>
                  <Link href={`/dashboard/tasks/${task.id}`} className="font-medium hover:underline">
                    {task.name}
                  </Link>
                  {task.instance?.workflow && (
                    <p className="text-muted-foreground text-xs">{task.instance.workflow.name}</p>
                  )}
                </TableCell>
                <TableCell>
                  <TaskStatusBadge status={task.status} />
                </TableCell>
                <TableCell>
                  <TaskPriorityBadge priority={task.priority} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {task.assignee?.name ?? 'Unassigned'}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-muted-foreground',
                    task.dueAt && isOverdue(task.dueAt) && task.status !== 'DONE' && 'text-destructive'
                  )}
                >
                  {task.dueAt ? formatDate(task.dueAt) : '—'}
                </TableCell>
                {showClaim && (
                  <TableCell className="text-right">
                    {task.status === 'PENDING' && !task.assignee ? (
                      <Button size="sm" disabled={isPending} onClick={() => claim(task.id)}>
                        {isPending ? <Loader2Icon className="animate-spin" /> : <HandIcon />}
                        Claim
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-xs">Taken</span>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Page {page} of {pageCount} · {total} tasks
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount}
              onClick={() => goToPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
