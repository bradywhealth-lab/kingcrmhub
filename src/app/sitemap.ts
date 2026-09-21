import type { MetadataRoute } from 'next'
import { PUBLIC_ROUTES, SITE_URL } from '@/lib/seo/site-config'

/**
 * Native Next.js sitemap (replaces the stale static public/sitemap.xml,
 * which only listed / and /auth). Served at /sitemap.xml.
 *
 * /claim is deliberately EXCLUDED from PUBLIC_ROUTES; the page itself carries
 * the noindex robot directive via src/app/claim/layout.tsx (same policy as
 * /auth*) so it never appears in search results even though the /welcome CTA
 * links to it.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path === '/' ? '' : route.path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))
}
