import type { MetadataRoute } from 'next'
import { DOC_SLUGS } from '@/shared/i18n/content'

/** Public routes included in the sitemap. Private routes are intentionally omitted. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  const now = new Date()

  const staticRoutes = ['', '/features', '/docs', '/api-reference', '/changelog', '/privacy', '/terms']
  const docRoutes = DOC_SLUGS.map((slug) => `/docs/${slug}`)

  return [...staticRoutes, ...docRoutes].map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : 0.6,
  }))
}