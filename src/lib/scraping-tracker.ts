import { db } from '@/lib/db'

export interface TrackScrapingInput {
  organizationId: string
  sourceDomain: string
  sourceType: string
  totalScraped: number
  leadsCreated: number
  avgLeadScore?: number
  professions?: string[]
}

/**
 * Tracks scraping performance for a specific source domain.
 * Creates a new ScrapingSourcePerformance record if one doesn't exist,
 * otherwise updates the existing record with new statistics.
 */
export async function trackScrapingPerformance(input: TrackScrapingInput) {
  const existing = await db.scrapingSourcePerformance.findUnique({
    where: {
      organizationId_sourceDomain: {
        organizationId: input.organizationId,
        sourceDomain: input.sourceDomain,
      },
    },
  })

  if (existing) {
    // Update existing record
    const updated = await db.scrapingSourcePerformance.update({
      where: { id: existing.id },
      data: {
        totalScraped: { increment: input.totalScraped },
        leadsCreated: { increment: input.leadsCreated },
        avgLeadScore: input.avgLeadScore,
        commonProfessions: input.professions,
        lastScrapedAt: new Date(),
      },
    })

    // Recalculate conversion rate
    const leadsConverted = existing.leadsConverted
    const totalLeads = existing.leadsCreated + input.leadsCreated
    const conversionRate = totalLeads > 0 ? leadsConverted / totalLeads : null

    return db.scrapingSourcePerformance.update({
      where: { id: existing.id },
      data: { conversionRate },
    })
  }

  // Create new record
  return db.scrapingSourcePerformance.create({
    data: {
      organizationId: input.organizationId,
      sourceDomain: input.sourceDomain,
      sourceType: input.sourceType,
      totalScraped: input.totalScraped,
      leadsCreated: input.leadsCreated,
      avgLeadScore: input.avgLeadScore,
      commonProfessions: input.professions,
      lastScrapedAt: new Date(),
    },
  })
}

/**
 * Records a lead conversion for a scraping source.
 * Called when a lead from a scraping source converts to a customer.
 */
export async function recordLeadConversion(
  organizationId: string,
  sourceDomain: string
) {
  const source = await db.scrapingSourcePerformance.findUnique({
    where: {
      organizationId_sourceDomain: {
        organizationId,
        sourceDomain,
      },
    },
  })

  if (!source) return

  const leadsConverted = source.leadsConverted + 1
  const conversionRate = source.leadsCreated > 0 ? leadsConverted / source.leadsCreated : 0

  return db.scrapingSourcePerformance.update({
    where: { id: source.id },
    data: {
      leadsConverted,
      conversionRate,
    },
  })
}

/**
 * Generates a performance report for all scraping sources in an organization.
 * Returns total metrics and top-performing sources ranked by conversion rate.
 */
export async function getScrapingPerformanceReport(organizationId: string) {
  const sources = await db.scrapingSourcePerformance.findMany({
    where: { organizationId },
    orderBy: { conversionRate: 'desc' },
  })

  return {
    totalSources: sources.length,
    topSources: sources.slice(0, 10),
    totalLeadsCreated: sources.reduce((sum, s) => sum + s.leadsCreated, 0),
    totalConversions: sources.reduce((sum, s) => sum + s.leadsConverted, 0),
  }
}
