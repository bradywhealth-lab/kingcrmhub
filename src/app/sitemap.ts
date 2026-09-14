import type { MetadataRoute } from 'next'
import { PUBLIC_ROUTES, SITE_URL } from '@/lib/seo/site-config'

/**
 * Native Next.js sitemap (replaces the stale static public/sitemap.xml,
 * which only listed / and /auth). Served at /sitemap.xml.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path === '/' ? '' : route.path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))
}
