/**
 * Single source of truth for public SEO constants.
 * Imported by app/layout.tsx, app/sitemap.ts, and page metadata exports.
 */

export const SITE_URL = 'https://kingcrmhub.net'
export const SITE_NAME = 'King CRM Hub'
export const SITE_TAGLINE = 'The client pipeline for one-person businesses'

/**
 * Routes that should appear in sitemap.xml.
 *
 * Excluded on purpose:
 * - /auth*        -> noindex (login/signup utility pages)
 * - /terms        -> noindex while legal copy is still a template
 * - /privacy      -> noindex while legal copy is still a template
 * - /welcome      -> duplicate of / (canonical points to /)
 * - /book/[slug]  -> dynamic tenant pages, discovered via links not sitemap
 * - /admin/*      -> authenticated app surface
 */
export const PUBLIC_ROUTES = [
  { path: '/', changeFrequency: 'daily' as const, priority: 1.0 },
  { path: '/pricing', changeFrequency: 'weekly' as const, priority: 0.9 },
  { path: '/compare', changeFrequency: 'weekly' as const, priority: 0.8 },
]
