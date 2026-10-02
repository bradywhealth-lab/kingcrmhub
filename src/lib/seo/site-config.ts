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
  /**
   * Brady's Books is a real public marketing page that returns 200 and carries a
   * canonical, so it belongs in the sitemap. Measured live:
   *   GET /books  -> 301 https://kingcrmhub.net/books/
   *   GET /books/ -> 200  "Brady's Books | Practical Paper Tools by Brady Wilson"
   *
   * It is NOT a Next.js route. Caddy serves it as a static site:
   *   handle_path /books* { root * /data/sites/bradys-books; file_server }
   *   redir /books /books/ permanent
   * so the entry must carry the trailing slash — submitting the redirecting URL
   * would make Google crawl a 301 hop every time.
   *
   * Still noindex and correctly EXCLUDED: /terms, /privacy, /claim, /welcome.
   */
  { path: '/books/', changeFrequency: 'weekly' as const, priority: 0.7 },
]
