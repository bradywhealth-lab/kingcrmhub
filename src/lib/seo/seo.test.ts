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
    ])
  })

  it('never lists auth, admin, welcome, or dynamic tenant routes', () => {
    const urls = sitemap().map((e) => e.url).join('\n')
    expect(urls).not.toMatch(/\/auth/)
    expect(urls).not.toMatch(/\/admin/)
    expect(urls).not.toMatch(/\/welcome/)
    expect(urls).not.toMatch(/\/book\//)
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
