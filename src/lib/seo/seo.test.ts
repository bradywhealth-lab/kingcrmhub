import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import sitemap from '@/app/sitemap'
import { PUBLIC_ROUTES, SITE_URL } from '@/lib/seo/site-config'
import {
  APPLICATION_OFFERS,
  organizationSchema,
  rootJsonLdGraph,
  softwareApplicationSchema,
  webSiteSchema,
} from '@/lib/seo/jsonld'

describe('sitemap', () => {
  it('lists exactly the curated public routes', () => {
    const entries = sitemap()
    expect(entries).toHaveLength(PUBLIC_ROUTES.length)
    expect(entries[0]!.url).toBe(SITE_URL)
    expect(entries.map((e) => e.url)).toEqual([
      `${SITE_URL}`,
      `${SITE_URL}/pricing`,
      `${SITE_URL}/compare`,
      `${SITE_URL}/books/`,
    ])
  })

  it('lists /books/ WITH the trailing slash, because /books 301s to /books/', () => {
    // Atlas measured this live:
    //   GET /books  -> 301 https://kingcrmhub.net/books/
    //   GET /books/ -> 200  ("Brady's Books | Practical Paper Tools by Brady Wilson")
    // /books is NOT a Next.js route — Caddy serves it as a static site:
    //   handle_path /books* { root * /data/sites/bradys-books; file_server }
    //   redir /books /books/ permanent
    // Submitting the redirecting URL would make Google crawl a hop.
    const urls = sitemap().map((e) => e.url)
    expect(urls).toContain(`${SITE_URL}/books/`)
    expect(urls).not.toContain(`${SITE_URL}/books`)
  })

  it('never lists auth, admin, welcome, or dynamic tenant routes', () => {
    const urls = sitemap().map((e) => e.url).join('\n')
    expect(urls).not.toMatch(/\/auth/)
    expect(urls).not.toMatch(/\/admin/)
    expect(urls).not.toMatch(/\/welcome/)
    // /book/[slug] is dynamic tenant booking content. NOTE this regex deliberately
    // requires the trailing slash: it must NOT match the static /books/ entry, and
    // it only avoids doing so because of the `s`. Asserting both directions so the
    // distinction can never silently break.
    expect(urls).not.toMatch(/\/book\//)
    expect(urls).toMatch(/\/books\//)
  })

  it('never lists a noindex page (guards the S22 false positive)', () => {
    // Sentinel routed "add /claim /terms /privacy to the sitemap". They are
    // DELIBERATELY noindex — verified in source:
    //   /terms, /privacy, /claim -> robots: { index: false, follow: true }
    //   /welcome                 -> alternates: { canonical: '/' }
    // Listing a noindex page sends Google a contradictory signal (indexed in the
    // sitemap, noindex on the page), which is a regression, not a fix.
    const urls = sitemap().map((e) => e.url)
    for (const banned of ['/terms', '/privacy', '/claim', '/welcome', '/auth', '/admin']) {
      expect(urls, `${banned} must stay out of the sitemap`).not.toContain(`${SITE_URL}${banned}`)
    }
  })

  it('the noindex claims above are TRUE in source, not assumed', () => {
    // Without this, the previous test would pass even if someone removed the
    // noindex metadata — at which point those pages SHOULD be added back.
    //
    // The metadata lives in DIFFERENT files per route, which matters:
    //   /terms, /privacy -> page.tsx (server components, can export metadata)
    //   /claim           -> layout.tsx, because the page is 'use client' and a
    //                       client component CANNOT export metadata. Its layout
    //                       comment states the policy explicitly: sitemap
    //                       exclusion alone is not enough since /welcome links
    //                       to it, so robots:noindex is enforced in the layout.
    // Reading only page.tsx would make this test fail on a false premise.
    const readIfExists = (rel: string) => {
      const p = join(process.cwd(), rel)
      return existsSync(p) ? readFileSync(p, 'utf8') : ''
    }

    for (const route of ['terms', 'privacy', 'claim']) {
      const combined =
        readIfExists(`src/app/${route}/page.tsx`) + readIfExists(`src/app/${route}/layout.tsx`)
      expect(combined, `/${route} must declare noindex in its page or layout`).toMatch(/index:\s*false/)
      expect(combined, `/${route} should still let links be followed`).toMatch(/follow:\s*true/)
    }

    const welcome =
      readIfExists('src/app/welcome/page.tsx') + readIfExists('src/app/welcome/layout.tsx')
    expect(welcome, '/welcome must canonicalise to /').toMatch(/canonical:\s*'\/'/)
  })
})

describe('jsonld', () => {
  it('root graph is valid schema.org JSON-LD with org + website + software app', () => {
    const graph = rootJsonLdGraph()
    expect(graph['@context']).toBe('https://schema.org')
    const items = graph['@graph'] as Record<string, unknown>[]
    expect(items).toHaveLength(3)
    expect(items[0]!['@type']).toBe('Organization')
    expect(items[1]!['@type']).toBe('WebSite')
    expect(items[2]!['@type']).toBe('SoftwareApplication')
    // round-trips through JSON without throwing
    expect(() => JSON.stringify(graph)).not.toThrow()
  })

  it('organization points at the production domain and logo', () => {
    const org = organizationSchema()
    expect(org.url).toBe('https://kingcrmhub.net')
    expect(org.logo).toBe('https://kingcrmhub.net/logo.svg')
  })

  it('website references the organization by @id', () => {
    const site = webSiteSchema()
    expect(site.publisher).toEqual({ '@id': `${SITE_URL}/#organization` })
  })

  it('software application offers mirror the four pricing tiers', () => {
    const app = softwareApplicationSchema()
    const offers = app.offers as Record<string, unknown>[]
    expect(offers).toHaveLength(4)
    expect(offers.map((o) => o.name)).toEqual([
      'Free plan',
      'Pro plan',
      'Studio plan',
      'Elite plan',
    ])
    expect(offers.every((o) => o.priceCurrency === 'USD')).toBe(true)
  })

  it('offers match the exported APPLICATION_OFFERS prices', () => {
    const app = softwareApplicationSchema()
    const offers = app.offers as { price: string }[]
    APPLICATION_OFFERS.forEach((tier, i) => {
      expect(offers[i]!.price).toBe(tier.price.toFixed(2))
    })
  })

  it('APPLICATION_OFFERS mirrors the real pricing PLANS (parity gate)', async () => {
    // Source of truth: the same PLANS array the /pricing page renders.
    // If monthly prices change there without updating APPLICATION_OFFERS,
    // this test fails — the JSON-LD cannot silently go stale.
    const { PLANS } = await import('@/components/pricing/crm-pricing-page')
    expect(APPLICATION_OFFERS).toHaveLength(PLANS.length)
    PLANS.forEach((plan, i) => {
      expect(APPLICATION_OFFERS[i]!.name).toBe(plan.name)
      expect(APPLICATION_OFFERS[i]!.price).toBe(plan.monthlyPrice)
    })
  })
})
