import type { Metadata } from 'next'
import Link from 'next/link'
import { DownloadIcon, KeyRoundIcon, WebhookIcon } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { ApiExplorer, type ApiEndpoint, type ApiGroup } from '@/shared/components/site/api-explorer'
import { CodeBlock } from '@/shared/components/site/code-block'
import { Section, SectionHeading } from '@/shared/components/site/section'
import { getTranslator } from '@/shared/i18n/server'
import type { Locale } from '@/shared/i18n/config'
import spec from '@/docs/api/openapi.json'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator()
  return { title: t('apiRef.title'), description: t('apiRef.subtitle') }
}

interface I18nNode {
  summary?: string
  description?: string
}
interface SpecSchema {
  type?: string | string[]
  enum?: unknown[]
  default?: unknown
  $ref?: string
}
interface SpecParam {
  name?: string
  in?: string
  required?: boolean
  description?: string
  schema?: SpecSchema
  $ref?: string
  'x-i18n'?: Record<string, I18nNode>
}
interface SpecOperation {
  summary?: string
  description?: string
  tags?: string[]
  operationId?: string
  'x-relay-scope'?: string
  'x-i18n'?: Record<string, I18nNode>
  parameters?: SpecParam[]
  responses?: Record<string, { description?: string; $ref?: string }>
}
type SpecDoc = {
  paths: Record<string, Record<string, SpecOperation | unknown>>
  components?: { parameters?: Record<string, SpecParam> }
}

const DOC = spec as unknown as SpecDoc
const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const

const TAG_ORDER = ['Workflows', 'Instances', 'Tasks']

function i18n(node: { 'x-i18n'?: Record<string, I18nNode> } & I18nNode, locale: Locale): I18nNode {
  if (locale === 'en') return { summary: node.summary, description: node.description }
  const ru = node['x-i18n']?.ru
  return {
    summary: ru?.summary ?? node.summary,
    description: ru?.description ?? node.description,
  }
}

function resolveParam(param: SpecParam): SpecParam {
  if (param.$ref) {
    const name = param.$ref.split('/').pop() ?? ''
    return DOC.components?.parameters?.[name] ?? param
  }
  return param
}

function typeLabel(schema?: SpecSchema): string {
  if (!schema) return 'string'
  const type = Array.isArray(schema.type) ? schema.type.join(' | ') : schema.type
  if (schema.enum && schema.enum.length > 0) return schema.enum.map((value) => String(value)).join(' | ')
  return type ?? 'string'
}

function exampleUrl(path: string): string {
  return `https://your-host${path.replace(/\{id\}/g, '$ID')}`
}

function buildCurl(method: string, path: string, hasQuery: boolean): string {
  const query = hasQuery ? '?status=PENDING&page=1' : ''
  const lines = [
    `curl -X ${method} "${exampleUrl(path)}${query}" \\`,
    '  -H "Authorization: Bearer $RELAY_API_KEY"',
  ]
  return lines.join('\n')
}

function buildFetch(method: string, path: string, hasQuery: boolean): string {
  const query = hasQuery ? '?status=PENDING&page=1' : ''
  return `const res = await fetch('${exampleUrl(path)}${query}', {
  method: '${method}',
  headers: { Authorization: \`Bearer \${process.env.RELAY_API_KEY}\` },
})
if (!res.ok) throw new Error(\`Relay API error: \${res.status}\`)
const body = await res.json()`
}

function buildGroups(locale: Locale): ApiGroup[] {
  const groups = new Map<string, ApiEndpoint[]>()

  for (const [path, item] of Object.entries(DOC.paths)) {
    for (const method of METHODS) {
      const operation = item[method] as SpecOperation | undefined
      if (!operation) continue

      const text = i18n(operation, locale)
      const tag = operation.tags?.[0] ?? 'Other'
      const params = (operation.parameters ?? []).map(resolveParam).map((param) => {
        const paramText = i18n(param as SpecParam & { 'x-i18n'?: Record<string, I18nNode> }, locale)
        return {
          name: param.name ?? '',
          location: param.in ?? '',
          required: Boolean(param.required),
          type: typeLabel(param.schema),
          description: paramText.description ?? param.description ?? '',
        }
      })

      const responses = Object.entries(operation.responses ?? {}).map(([code, response]) => ({
        code,
        description: response.description ?? '',
      }))

      const hasQuery = params.some((param) => param.location === 'query')
      const endpoint: ApiEndpoint = {
        id: operation.operationId ?? `${method}-${path}`,
        method: method.toUpperCase(),
        path,
        scope: operation['x-relay-scope'] ?? '',
        summary: text.summary ?? '',
        description: text.description ?? '',
        params,
        responses,
        curl: buildCurl(method.toUpperCase(), path, hasQuery),
        fetchCode: buildFetch(method.toUpperCase(), path, hasQuery),
      }

      const list = groups.get(tag) ?? []
      list.push(endpoint)
      groups.set(tag, list)
    }
  }

  return [...groups.entries()]
    .sort((a, b) => TAG_ORDER.indexOf(a[0]) - TAG_ORDER.indexOf(b[0]))
    .map(([name, endpoints]) => ({ name, endpoints }))
}

export default async function ApiReferencePage() {
  const { t, locale } = await getTranslator()
  const groups = buildGroups(locale)

  const errorRows = [
    { code: '401', key: 'unauthorized' },
    { code: '403', key: 'forbidden' },
    { code: '404', key: 'not_found' },
    { code: '409', key: 'conflict' },
    { code: '422', key: 'validation' },
    { code: '429', key: 'rate_limited' },
    { code: '500', key: 'internal' },
  ]

  return (
    <>
      <Section>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionHeading as="h1" align="start" title={t('apiRef.title')} subtitle={t('apiRef.subtitle')} />
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/docs/integrations">{t('nav.integrations')}</Link>
            </Button>
            <Button asChild>
              <a href="/api/openapi" download="relay-openapi.json">
                <DownloadIcon aria-hidden="true" />
                {t('apiRef.download')}
              </a>
            </Button>
          </div>
        </div>

        <div className="mt-10">
          <ApiExplorer
            groups={groups}
            labels={{
              searchPlaceholder: t('apiRef.searchPlaceholder'),
              noResults: t('apiRef.noResults'),
              scope: t('apiRef.scope'),
              parameters: t('apiRef.parameters'),
              name: t('apiRef.name'),
              type: t('apiRef.type'),
              in: t('apiRef.in'),
              requiredColumn: t('apiRef.requiredColumn'),
              description: t('apiRef.description'),
              requestExample: t('apiRef.requestExample'),
              responseExample: t('apiRef.responseExample'),
              copy: t('common.copy'),
              copied: t('common.copied'),
              copyFailed: t('common.copyFailed'),
              copyCurl: t('apiRef.copyCurl'),
              copyFetch: t('apiRef.copyFetch'),
            }}
          />
        </div>
      </Section>

      <Section bordered muted>
        <div className="grid gap-8 lg:grid-cols-2">
          <Card className="bg-card/50">
            <CardContent className="space-y-3">
              <h2 className="flex items-center gap-2 font-semibold">
                <KeyRoundIcon className="text-primary size-4" aria-hidden="true" />
                {t('apiRef.authenticationHeading')}
              </h2>
              <p className="text-muted-foreground text-sm">
                {t('apiRef.baseUrl')}: <code className="bg-muted rounded px-1.5 py-0.5">/api/v1</code>
              </p>
              <CodeBlock
                language="bash"
                copyLabel={t('common.copy')}
                copiedLabel={t('common.copied')}
                failedLabel={t('common.copyFailed')}
                code={`curl https://your-host/api/v1/workflows \\
  -H "Authorization: Bearer $RELAY_API_KEY"`}
              />
            </CardContent>
          </Card>

          <Card className="bg-card/50">
            <CardContent className="space-y-3">
              <h2 className="font-semibold">{t('apiRef.errorsHeading')}</h2>
              <ul className="space-y-1 text-sm">
                {errorRows.map((row) => (
                  <li key={row.code} className="flex gap-3">
                    <code className="w-10 shrink-0 font-semibold">{row.code}</code>
                    <span className="text-muted-foreground font-mono text-xs">{row.key}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card/50 mt-8">
          <CardContent className="space-y-3">
            <h2 className="font-semibold">{t('apiRef.paginationHeading')}</h2>
            <p className="text-muted-foreground text-sm">
              <code className="bg-muted rounded px-1.5 py-0.5">?page=</code> · meta: total, page, pageSize
            </p>
          </CardContent>
        </Card>

        <div className="mt-8 space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <WebhookIcon className="text-primary size-4" aria-hidden="true" />
            {t('apiRef.webhooksHeading')}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {[
              'task.created',
              'task.claimed',
              'task.completed',
              'task.decided',
              'instance.started',
              'instance.completed',
              'workflow.published',
            ].map((event) => (
              <li key={event}>
                <code className="bg-muted rounded px-2 py-1 text-xs">{event}</code>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-sm">
            <Link href="/docs/integrations" className="underline underline-offset-4">
              {t('docs.integrationsTitle')}
            </Link>
          </p>
        </div>
      </Section>
    </>
  )
}
