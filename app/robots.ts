import type { MetadataRoute } from 'next'

/**
 * Only public marketing/docs routes are indexable. Authenticated areas
 * (/dashboard), the API and invitation links are excluded — they either contain
 * personal data or should not appear in search results.
 */
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard', '/invitations', '/api/', '/messages'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}