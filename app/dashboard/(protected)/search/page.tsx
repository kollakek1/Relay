import Link from 'next/link'
import { requireContext } from '@/shared/server/auth-context'
import { searchAll } from '@/features/search/server/service'
import { PageHeader } from '@/shared/components/page-header'
import { EmptyState } from '@/shared/components/empty-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { SearchInput } from '@/features/search/components/search-input'
import { SearchIcon } from 'lucide-react'

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const ctx = await requireContext()
  const { q } = await searchParams
  const results = await searchAll(ctx, q ?? '')
  const total =
    results.workflows.length + results.tasks.length + results.instances.length + results.members.length

  const groups = [
    {
      title: 'Workflows',
      items: results.workflows.map((w) => ({
        key: w.id,
        href: `/dashboard/workflows/${w.id}`,
        label: w.name,
        meta: w.status,
      })),
    },
    {
      title: 'Tasks',
      items: results.tasks.map((t) => ({
        key: t.id,
        href: `/dashboard/tasks/${t.id}`,
        label: t.name,
        meta: t.assignee ? `${t.status} · ${t.assignee}` : t.status,
      })),
    },
    {
      title: 'Process instances',
      items: results.instances.map((i) => ({
        key: i.id,
        href: `/dashboard/instances`,
        label: i.workflowName,
        meta: i.status,
      })),
    },
    {
      title: 'Members',
      items: results.members.map((m) => ({
        key: m.id,
        href: `/dashboard/team`,
        label: m.name,
        meta: m.email,
      })),
    },
  ]

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8 lg:p-10">
      <PageHeader title="Search" description="Find anything across this workspace." />
      <SearchInput initialQuery={q ?? ''} />

      {!q || q.trim().length < 2 ? (
        <p className="text-muted-foreground text-sm">Type at least two characters to search.</p>
      ) : total === 0 ? (
        <EmptyState
          icon={SearchIcon}
          title={`No results for “${q}”`}
          description="Try a different term."
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {groups
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <Card key={group.title}>
                <CardHeader>
                  <CardTitle className="text-base">{group.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {group.items.map((item) => (
                    <Link
                      key={item.key}
                      href={item.href}
                      className="hover:bg-muted/50 flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors"
                    >
                      <span className="truncate text-sm font-medium">{item.label}</span>
                      <Badge variant="outline" className="shrink-0">
                        {item.meta}
                      </Badge>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </main>
  )
}
