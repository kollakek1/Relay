/**
 * Validates relative links in the repository's Markdown files.
 *
 * GitHub only surfaces a broken link when someone clicks it, so this makes the
 * check deterministic: every `](relative/path)` target must exist on disk, and
 * every `#anchor` must match a heading in the target file. External `http(s)`
 * links are ignored (they would make CI depend on the network).
 *
 * Run with `npm run docs:check`. Exits non-zero when a link is broken.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const ROOT = process.cwd()
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'prisma', 'coverage', 'test-results'])

function markdownFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) markdownFiles(full, found)
    else if (entry.endsWith('.md')) found.push(full)
  }
  return found
}

/** Slug the way GitHub does for a heading (approximate but consistent). */
function slugify(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[`*_[\]()#!.,:;'"“”’]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function anchorsOf(file: string): Set<string> {
  const anchors = new Set<string>()
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^#{1,6}\s+(.*)$/.exec(line)
    if (match) anchors.add(slugify(match[1]))
  }
  return anchors
}

const INLINE_LINK = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

let failed = false
let checked = 0

for (const file of markdownFiles(ROOT)) {
  const body = readFileSync(file, 'utf8')
  const dir = dirname(file)

  for (const match of body.matchAll(INLINE_LINK)) {
    const target = match[1]

    // External, mail and protocol-relative links are out of scope.
    if (/^(https?:|mailto:|tel:|#)/i.test(target)) continue
    // Ignore badge/image services and template placeholders.
    if (target.includes('{{') || target.includes('<')) continue

    const [rawPath, anchor] = target.split('#')
    const cleanPath = rawPath.replace(/^\.\//, '')
    const absolute = resolve(dir, decodeURIComponent(cleanPath))

    checked += 1

    if (!existsSync(absolute)) {
      failed = true
      console.error(`x ${relative(ROOT, file)} -> ${target} (no such file)`)
      continue
    }

    if (anchor && absolute.endsWith('.md')) {
      if (!anchorsOf(absolute).has(slugify(anchor))) {
        failed = true
        console.error(`x ${relative(ROOT, file)} -> ${target} (no such heading)`)
      }
    }
  }
}

console.log(`Checked ${checked} relative links across the repository's Markdown.`)
if (failed) {
  console.error('\nDocumentation link check failed.')
  process.exit(1)
}
console.log('Documentation link check passed.')
