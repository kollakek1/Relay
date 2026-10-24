'use client'

import { useMemo, useState } from 'react'
import { ChevronDownIcon, SearchIcon } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import { CodeBlock } from '@/shared/components/site/code-block'
import { cn } from '@/shared/lib/utils'

export interface ApiParam {
  name: string
  location: string
  required: boolean
  type: string
  description: string
}

export interface ApiResponse {
  code: string
  description: string
}

export interface ApiEndpoint {
  id: string
  method: string
  path: string
  scope: string
  summary: string
  description: string
  params: ApiParam[]
  responses: ApiResponse[]
  curl: string
  fetchCode: string
}

export interface ApiGroup {
  name: string
  endpoints: ApiEndpoint[]
}

export interface ApiExplorerLabels {
  searchPlaceholder: string
  noResults: string
  scope: string
  parameters: string
  name: string
  type: string
  in: string
  requiredColumn: string
  description: string
  requestExample: string
  responseExample: string
  copy: string
  copied: string
  copyFailed: string
  copyCurl: string
  copyFetch: string
}

const METHOD_STYLES: Record<string, string> = {
  GET: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  POST: 'bg-primary/10 text-primary',
  PUT: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  PATCH: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  DELETE: 'bg-destructive/10 text-destructive',
}

/**
 * Interactive API reference. Filtering happens client-side over a static,
 * server-rendered endpoint list (no API call, no third-party UI bundle).
 * Examples are copyable and match the real contracts.
 */
export function ApiExplorer({
  groups,
  labels,
}: {
  groups: ApiGroup[]
  labels: ApiExplorerLabels
}) {
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(groups[0]?.endpoints[0]?.id ?? null)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return groups
    return groups
      .map((group) => ({
        ...group,
        endpoints: group.endpoints.filter((endpoint) =>
          `${endpoint.method} ${endpoint.path} ${endpoint.summary} ${endpoint.description}`
            .toLowerCase()
            .includes(needle)
        ),
      }))
      .filter((group) => group.endpoints.length > 0)
  }, [groups, query])

  return (
    <div className="space-y-6">
      <div className="relative max-w-md">
        <SearchIcon
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={labels.searchPlaceholder}
          aria-label={labels.searchPlaceholder}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm">{labels.noResults}</p>
      ) : (
        <div className="space-y-8">
          {filtered.map((group) => (
            <section key={group.name} aria-label={group.name} className="space-y-3">
              <h3 className="text-sm font-semibold tracking-wide uppercase">{group.name}</h3>
              <ul className="space-y-2">
                {group.endpoints.map((endpoint) => {
                  const open = openId === endpoint.id
                  return (
                    <li key={endpoint.id} className="border-border bg-card/40 rounded-lg border">
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : endpoint.id)}
                        aria-expanded={open}
                        aria-controls={`endpoint-${endpoint.id}`}
                        className="focus-visible:ring-ring flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left focus-visible:ring-2 focus-visible:outline-none"
                      >
                        <span
                          className={cn(
                            'inline-flex w-14 shrink-0 justify-center rounded px-2 py-1 font-mono text-xs font-semibold',
                            METHOD_STYLES[endpoint.method] ?? 'bg-muted text-muted-foreground'
                          )}
                        >
                          {endpoint.method}
                        </span>
                        <code className="flex-1 truncate text-sm">{endpoint.path}</code>
                        <span className="text-muted-foreground hidden truncate text-sm sm:block">
                          {endpoint.summary}
                        </span>
                        <ChevronDownIcon
                          className={cn(
                            'text-muted-foreground size-4 shrink-0 transition-transform',
                            open && 'rotate-180'
                          )}
                          aria-hidden="true"
                        />
                      </button>

                      {open ? (
                        <div id={`endpoint-${endpoint.id}`} className="space-y-5 border-t px-4 py-4">
                          <div className="space-y-2">
                            <p className="text-sm leading-relaxed">{endpoint.description}</p>
                            <p className="text-muted-foreground text-xs">
                              {labels.scope}:{' '}
                              <code className="bg-muted rounded px-1.5 py-0.5">{endpoint.scope}</code>
                            </p>
                          </div>

                          {endpoint.params.length > 0 ? (
                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold">{labels.parameters}</h4>
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                  <thead className="text-muted-foreground">
                                    <tr className="border-b">
                                      <th scope="col" className="py-1.5 pr-4 font-medium">
                                        {labels.name}
                                      </th>
                                      <th scope="col" className="py-1.5 pr-4 font-medium">
                                        {labels.in}
                                      </th>
                                      <th scope="col" className="py-1.5 pr-4 font-medium">
                                        {labels.type}
                                      </th>
                                      <th scope="col" className="py-1.5 pr-4 font-medium">
                                        {labels.requiredColumn}
                                      </th>
                                      <th scope="col" className="py-1.5 font-medium">
                                        {labels.description}
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {endpoint.params.map((param) => (
                                      <tr key={`${param.location}:${param.name}`} className="border-b last:border-0">
                                        <td className="py-1.5 pr-4 font-mono">{param.name}</td>
                                        <td className="py-1.5 pr-4">{param.location}</td>
                                        <td className="py-1.5 pr-4 font-mono">{param.type}</td>
                                        <td className="py-1.5 pr-4">
                                          {param.required ? (
                                            <Badge variant="secondary">{labels.requiredColumn}</Badge>
                                          ) : (
                                            '—'
                                          )}
                                        </td>
                                        <td className="py-1.5">{param.description}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : null}

                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold">{labels.responseExample}</h4>
                            <ul className="space-y-1 text-xs">
                              {endpoint.responses.map((response) => (
                                <li key={response.code} className="flex gap-3">
                                  <code className="w-10 shrink-0 font-semibold">{response.code}</code>
                                  <span className="text-muted-foreground">{response.description}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="grid gap-4 lg:grid-cols-2">
                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold">
                                {labels.requestExample} · curl
                              </h4>
                              <CodeBlock
                                code={endpoint.curl}
                                language="bash"
                                copyLabel={labels.copyCurl}
                                copiedLabel={labels.copied}
                                failedLabel={labels.copyFailed}
                              />
                            </div>
                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold">
                                {labels.requestExample} · JavaScript
                              </h4>
                              <CodeBlock
                                code={endpoint.fetchCode}
                                language="javascript"
                                copyLabel={labels.copyFetch}
                                copiedLabel={labels.copied}
                                failedLabel={labels.copyFailed}
                              />
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
