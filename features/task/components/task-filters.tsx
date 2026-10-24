'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Loader2Icon, SearchIcon } from 'lucide-react'
import { TASK_STATUSES, TASK_PRIORITIES } from '@/features/task/schemas/taskSchema'

const STATUS_OPTIONS = ['all', ...TASK_STATUSES] as const
const PRIORITY_OPTIONS = ['all', ...TASK_PRIORITIES] as const

export function TaskFilters({ showAssignee = true }: { showAssignee?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(params.get('q') ?? '')

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString())
    if (!value || value === 'all') next.delete(key)
    else next.set(key, value)
    next.delete('page')
    startTransition(() => router.push(`${pathname}?${next.toString()}`))
  }

  // Debounce the search box into the URL.
  useEffect(() => {
    const current = params.get('q') ?? ''
    if (search === current) return
    const timer = setTimeout(() => update('q', search), 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-52 flex-1">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          id="task-search"
          name="q"
          autoComplete="off"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search tasks"
          className="pl-9"
          aria-label="Search tasks"
        />
        {isPending && (
          <Loader2Icon className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />
        )}
      </div>

      <Select value={params.get('status') ?? 'all'} onValueChange={(value) => update('status', value)}>
        <SelectTrigger id="task-filter-status" className="w-36" aria-label="Filter by status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((status) => (
            <SelectItem key={status} value={status}>
              {status === 'all' ? 'All statuses' : status.replace('_', ' ').toLowerCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showAssignee && (
        <Select
          value={params.get('assignee') ?? 'all'}
          onValueChange={(value) => update('assignee', value)}
        >
          <SelectTrigger id="task-filter-assignee" className="w-36" aria-label="Filter by assignee">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everyone</SelectItem>
            <SelectItem value="me">Assigned to me</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
          </SelectContent>
        </Select>
      )}

      <Select
        value={params.get('priority') ?? 'all'}
        onValueChange={(value) => update('priority', value)}
      >
        <SelectTrigger id="task-filter-priority" className="w-32" aria-label="Filter by priority">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          {PRIORITY_OPTIONS.map((priority) => (
            <SelectItem key={priority} value={priority}>
              {priority === 'all' ? 'Any priority' : priority.toLowerCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={params.get('sort') ?? 'createdAt'}
        onValueChange={(value) => update('sort', value)}
      >
        <SelectTrigger id="task-filter-sort" className="w-40" aria-label="Sort tasks">
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="createdAt">Newest first</SelectItem>
          <SelectItem value="dueAt">By due date</SelectItem>
          <SelectItem value="priority">By priority</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
