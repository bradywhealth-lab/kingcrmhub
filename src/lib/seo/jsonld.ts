import { SITE_NAME, SITE_TAGLINE, SITE_URL } from './site-config'

/**
 * JSON-LD structured data builders (schema.org).
 * Pure functions so they can be unit-tested without rendering React.
 */

export type JsonLd = Record<string, unknown>

export function organizationSchema(): JsonLd {
  return {
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.svg`,
    description: SITE_TAGLINE,
  }
}

export function webSiteSchema(): JsonLd {
  return {
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    description: SITE_TAGLINE,
    publisher: { '@id': `${SITE_URL}/#organization` },
    inLanguage: 'en',
  }
}

/**
 * Offer data mirrors PLANS in src/components/pricing/crm-pricing-page.tsx
 * (Free $0, Pro $19/mo, Studio $39/mo, Elite $69/mo — monthly, USD).
 * Keep the two in sync when pricing changes.
 */
export const APPLICATION_OFFERS = [
  { name: 'Free', price: 0 },
  { name: 'Pro', price: 19 },
  { name: 'Studio', price: 39 },
  { name: 'Elite', price: 69 },
] as const

export function softwareApplicationSchema(): JsonLd {
  return {
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    url: SITE_URL,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'CRM',
    operatingSystem: 'Web',
    description:
      'Client pipeline for freelancers and one-person businesses: lead capture, follow-up automation, client booking, proposals, and AI guidance in one workspace.',
    offers: APPLICATION_OFFERS.map((offer) => ({
      '@type': 'Offer',
      name: `${offer.name} plan`,
      price: offer.price.toFixed(2),
      priceCurrency: 'USD',
      url: `${SITE_URL}/pricing`,
      category: 'subscription',
    })),
    publisher: { '@id': `${SITE_URL}/#organization` },
  }
}

/** Graph combining org + website + software application, rendered once in the root layout. */
export function rootJsonLdGraph(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@graph': [organizationSchema(), webSiteSchema(), softwareApplicationSchema()],
  }
}
