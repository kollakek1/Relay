import spec from '@/docs/api/openapi.json'

/**
 * Serves the canonical OpenAPI 3.1 document for download and for external
 * tooling. The file under docs/api/ is the single source of truth (it is also
 * imported by /api-reference and validated in CI).
 */
export function GET() {
  return new Response(JSON.stringify(spec, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': 'inline; filename="relay-openapi.json"',
      'cache-control': 'public, max-age=300',
    },
  })
}