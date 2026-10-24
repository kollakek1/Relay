/**
 * Validates `docs/api/openapi.json` in CI.
 *
 * Beyond structural checks, this asserts that the specification matches the
 * *implementation*: every documented path must resolve to a real Next.js route
 * file, and every route handler under app/api/v1 must be documented. That is
 * the check that stops the docs from drifting away from the code.
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import spec from '../docs/api/openapi.json'

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options'])
const ROOT = process.cwd()

let failed = false
function fail(message: string): void {
  failed = true
  console.error(`x ${message}`)
}
function ok(message: string): void {
  console.log(`ok ${message}`)
}

// --- Basic structure ---------------------------------------------------------

if (!/^3\.1\./.test(spec.openapi)) fail(`Expected OpenAPI 3.1, found "${spec.openapi}"`)
if (!spec.info?.title || !spec.info?.version) fail('info.title and info.version are required')
if (!spec.components?.securitySchemes?.apiKey) fail('components.securitySchemes.apiKey is required')

// --- $ref resolution ---------------------------------------------------------

function resolveRef(ref: string): unknown {
  if (!ref.startsWith('#/')) return undefined
  return ref
    .slice(2)
    .split('/')
    .reduce<unknown>((node, part) => {
      if (node && typeof node === 'object') {
        return (node as Record<string, unknown>)[part.replace(/~1/g, '/').replace(/~0/g, '~')]
      }
      return undefined
    }, spec as unknown)
}

function walkRefs(node: unknown, path: string): void {
  if (Array.isArray(node)) {
    node.forEach((item, index) => walkRefs(item, `${path}/${index}`))
    return
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === '$ref' && typeof value === 'string') {
        if (resolveRef(value) === undefined) fail(`Unresolved $ref "${value}" at ${path}`)
      } else if (key !== 'example' && key !== 'examples' && key !== 'x-i18n') {
        walkRefs(value, `${path}/${key}`)
      }
    }
  }
}
walkRefs(spec, '#')

// --- Operations --------------------------------------------------------------

const operationIds = new Set<string>()
const documentedPaths = new Set<string>()

for (const [routePath, item] of Object.entries(spec.paths as Record<string, Record<string, unknown>>)) {
  if (!routePath.startsWith('/')) fail(`Path "${routePath}" must start with "/"`)
  documentedPaths.add(routePath)

  const operations = Object.entries(item).filter(([method]) => HTTP_METHODS.has(method))
  if (operations.length === 0) fail(`Path "${routePath}" has no operations`)

  for (const [method, operation] of operations) {
    const op = operation as Record<string, unknown>
    const id = op.operationId
    if (typeof id !== 'string' || id.length === 0) {
      fail(`${method.toUpperCase()} ${routePath} is missing operationId`)
    } else if (operationIds.has(id)) {
      fail(`Duplicate operationId "${id}"`)
    } else {
      operationIds.add(id)
    }

    if (typeof op.summary !== 'string' || op.summary.length === 0) {
      fail(`${method.toUpperCase()} ${routePath} is missing a summary`)
    }
    if (typeof op['x-relay-scope'] !== 'string') {
      fail(`${method.toUpperCase()} ${routePath} is missing x-relay-scope`)
    }

    const responses = op.responses as Record<string, unknown> | undefined
    if (!responses || Object.keys(responses).length === 0) {
      fail(`${method.toUpperCase()} ${routePath} has no responses`)
    } else {
      for (const [code, response] of Object.entries(responses)) {
        if (!/^[1-5]\d\d$/.test(code) && code !== 'default') {
          fail(`${method.toUpperCase()} ${routePath} has a non-numeric status code "${code}"`)
        }
        const raw = response as Record<string, unknown>
        const resolved = (
          typeof raw.$ref === 'string' ? resolveRef(raw.$ref) : raw
        ) as Record<string, unknown> | undefined
        const description = resolved?.description
        if (typeof description !== 'string' || description.length === 0) {
          fail(`${method.toUpperCase()} ${routePath} response ${code} is missing a description`)
        }
      }
      if (!Object.keys(responses).some((code) => code.startsWith('2'))) {
        fail(`${method.toUpperCase()} ${routePath} has no success response`)
      }
    }
  }
}

// --- Spec ? implementation correspondence ------------------------------------

function routeFileToSpecPath(relative: string): string {
  const withoutPrefix = relative.replace(/^app/, '').replace(/\\/g, '/')
  const withoutRoute = withoutPrefix.replace(/\/route\.ts$/, '')
  return withoutRoute.replace(/\[([^\]]+)\]/g, '{$1}')
}

function collectRouteFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) collectRouteFiles(full, found)
    else if (entry === 'route.ts') found.push(full)
  }
  return found
}

const apiDir = join(ROOT, 'app', 'api', 'v1')
const implementedPaths = new Set(
  collectRouteFiles(apiDir).map((file) => routeFileToSpecPath(file.slice(ROOT.length).replace(/^[/\\]/, '')))
)

for (const documented of documentedPaths) {
  const file = join(ROOT, 'app', documented.replace(/^\//, '').replace(/\{([^}]+)\}/g, '[$1]'), 'route.ts')
  if (!existsSync(file)) {
    fail(`Documented path ${documented} has no route file at app/${documented.replace(/^\//, '')}/route.ts`)
  }
}

for (const implemented of implementedPaths) {
  if (!documentedPaths.has(implemented)) {
    fail(`Implemented route ${implemented} is not documented in the OpenAPI spec`)
  }
}

ok(`${Object.keys(spec.paths).length} documented paths match ${implementedPaths.size} implemented routes`)

if (failed) {
  console.error('\nOpenAPI check failed.')
  process.exit(1)
}
console.log('\nOpenAPI check passed.')
