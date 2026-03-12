import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

const ORGANIZATION_ID = 'demo-org-1'
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

type ScrapeConfig = {
  maxPages: number
  followLinks: boolean
  respectRobots: boolean
  useHeadless: boolean
  delayMs: number
  jitterMs?: number
  rotateUserAgent?: boolean
  proxyEnabled?: boolean
  proxyProvider?: 'none' | 'scrapingbee' | 'proxy_template'
  proxyUrlTemplate?: string
  selectors?: Record<string, string>
}

type ScrapeContact = {
  sourceUrl: string
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
  company?: string
  title?: string
  rawData: Prisma.InputJsonObject
}

const runningJobs = new Set<string>()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const {
      url,
      urls,
      type = 'website',
      name,
      maxPages = 15,
      followLinks = true,
      respectRobots = false,
      useHeadless = true,
      delayMs = 400,
      jitterMs = 150,
      rotateUserAgent = true,
      proxyEnabled = false,
      proxyProvider = 'none',
      proxyUrlTemplate = '',
      selectors = {},
    } = body as {
      url?: string
      urls?: string[]
      type?: string
      name?: string
      maxPages?: number
      followLinks?: boolean
      respectRobots?: boolean
      useHeadless?: boolean
      delayMs?: number
      jitterMs?: number
      rotateUserAgent?: boolean
      proxyEnabled?: boolean
      proxyProvider?: 'none' | 'scrapingbee' | 'proxy_template'
      proxyUrlTemplate?: string
      selectors?: Record<string, string>
    }

    const targetUrls = (url ? [url] : Array.isArray(urls) ? urls : [])
      .map((u) => u.trim())
      .filter(Boolean)
    if (targetUrls.length === 0) {
      return NextResponse.json({ error: 'url or urls array is required' }, { status: 400 })
    }

    const config: ScrapeConfig = {
      maxPages: Math.max(1, Math.min(100, Number(maxPages) || 15)),
      followLinks: !!followLinks,
      respectRobots: !!respectRobots,
      useHeadless: !!useHeadless,
      delayMs: Math.max(0, Math.min(10_000, Number(delayMs) || 400)),
      jitterMs: Math.max(0, Math.min(3_000, Number(jitterMs) || 150)),
      rotateUserAgent: !!rotateUserAgent,
      proxyEnabled: !!proxyEnabled,
      proxyProvider,
      proxyUrlTemplate: proxyUrlTemplate || '',
      selectors: selectors || {},
    }

    const job = await db.scrapeJob.create({
      data: {
        organizationId: ORGANIZATION_ID,
        name: name?.trim() || null,
        sourceUrl: targetUrls[0],
        urls: targetUrls,
        type,
        status: 'pending',
        config,
        stats: {
          pagesScraped: 0,
          contactsFound: 0,
          leadsCreated: 0,
          duplicates: 0,
          errors: [],
        },
      },
    })

    void runScrapeJob(job.id).catch((error) => {
      console.error(`Scrape job ${job.id} crashed:`, error)
    })

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      message: 'Scrape job queued. Poll /api/scrape?jobId=... for progress.',
    })
  } catch (error) {
    console.error('Scrape POST error:', error)
    return NextResponse.json(
      { error: 'Failed to create scrape job', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    const limit = Math.max(1, Math.min(100, Number(searchParams.get('limit') || '20')))

    if (jobId) {
      const job = await db.scrapeJob.findFirst({
        where: { id: jobId, organizationId: ORGANIZATION_ID },
        include: {
          contacts: {
            orderBy: { createdAt: 'desc' },
            take: 100,
          },
        },
      })
      if (!job) return NextResponse.json({ error: 'Scrape job not found' }, { status: 404 })
      return NextResponse.json({ job })
    }

    const jobs = await db.scrapeJob.findMany({
      where: { organizationId: ORGANIZATION_ID },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return NextResponse.json({ jobs })
  } catch (error) {
    console.error('Scrape GET error:', error)
    return NextResponse.json({ error: 'Failed to load scrape jobs' }, { status: 500 })
  }
}

async function runScrapeJob(jobId: string) {
  if (runningJobs.has(jobId)) return
  runningJobs.add(jobId)

  try {
    const job = await db.scrapeJob.findUnique({ where: { id: jobId } })
    if (!job) return

    const config = (job.config || {}) as ScrapeConfig
    const queue = [
      ...(Array.isArray(job.urls) ? (job.urls as string[]) : [job.sourceUrl]),
    ].filter(Boolean)
    const visited = new Set<string>()
    const contacts: ScrapeContact[] = []
    const errors: string[] = []

    await db.scrapeJob.update({
      where: { id: jobId },
      data: { status: 'running', startedAt: new Date() },
    })

    while (queue.length > 0 && visited.size < (config.maxPages || 15)) {
      const current = normalizeUrl(queue.shift() || '')
      if (!current || visited.has(current)) continue
      visited.add(current)

      try {
        if (config.respectRobots) {
          const allowed = await isAllowedByRobots(current)
          if (!allowed) {
            errors.push(`${current}: blocked by robots policy`)
            continue
          }
        }
        const html = await fetchPage(current, config)
        const extracted = extractContactsFromHtml(current, html)
        contacts.push(...extracted)

        if (config.followLinks) {
          const discoveredLinks = extractLinks(current, html)
          for (const link of discoveredLinks) {
            if (!visited.has(link) && queue.length + visited.size < (config.maxPages || 15) * 2) {
              queue.push(link)
            }
          }
        }
      } catch (error) {
        errors.push(`${current}: ${error instanceof Error ? error.message : 'Unknown fetch error'}`)
      }

      const jitter = config.jitterMs ? Math.floor(Math.random() * config.jitterMs) : 0
      if (config.delayMs || jitter) await sleep((config.delayMs || 0) + jitter)
    }

    const unique = dedupeContacts(contacts)
    let leadsCreated = 0
    let duplicates = 0

    for (const contact of unique) {
      if (!contact.email && !contact.phone) continue
      const existing = await db.lead.findFirst({
        where: {
          organizationId: ORGANIZATION_ID,
          OR: [
            ...(contact.email ? [{ email: contact.email.toLowerCase() }] : []),
            ...(contact.phone ? [{ phone: normalizePhone(contact.phone) }] : []),
          ],
        },
      })

      if (existing) {
        duplicates++
        await db.scrapedContact.create({
          data: {
            organizationId: ORGANIZATION_ID,
            scrapeJobId: jobId,
            sourceUrl: contact.sourceUrl,
            rawData: contact.rawData,
            email: contact.email || null,
            phone: contact.phone ? normalizePhone(contact.phone) : null,
            firstName: contact.firstName || null,
            lastName: contact.lastName || null,
            company: contact.company || null,
            title: contact.title || null,
            leadId: existing.id,
          },
        })
        continue
      }

      const lead = await db.lead.create({
        data: {
          organizationId: ORGANIZATION_ID,
          source: 'scrape',
          status: 'new',
          firstName: contact.firstName || null,
          lastName: contact.lastName || null,
          email: contact.email?.toLowerCase() || null,
          phone: contact.phone ? normalizePhone(contact.phone) : null,
          company: contact.company || null,
          title: contact.title || null,
          aiInsights: {
            scrapedFrom: contact.sourceUrl,
          },
        },
      })

      await db.scrapedContact.create({
        data: {
          organizationId: ORGANIZATION_ID,
          scrapeJobId: jobId,
          sourceUrl: contact.sourceUrl,
          rawData: contact.rawData,
          email: contact.email || null,
          phone: contact.phone ? normalizePhone(contact.phone) : null,
          firstName: contact.firstName || null,
          lastName: contact.lastName || null,
          company: contact.company || null,
          title: contact.title || null,
          leadId: lead.id,
        },
      })

      await db.activity.create({
        data: {
          organizationId: ORGANIZATION_ID,
          leadId: lead.id,
          type: 'import',
          title: 'Lead imported from web scrape',
          description: contact.sourceUrl,
        },
      })
      leadsCreated++
    }

    const status = errors.length > 0 && leadsCreated === 0 ? 'failed' : errors.length > 0 ? 'partial' : 'completed'
    await db.scrapeJob.update({
      where: { id: jobId },
      data: {
        status,
        completedAt: new Date(),
        error: errors.length > 0 ? errors.slice(0, 20).join(' | ') : null,
        stats: {
          pagesScraped: visited.size,
          contactsFound: unique.length,
          leadsCreated,
          duplicates,
          errors,
        },
      },
    })
  } finally {
    runningJobs.delete(jobId)
  }
}

async function fetchPage(url: string, config: ScrapeConfig): Promise<string> {
  // Proxy provider strategy (anti-block).
  if (config.proxyEnabled && config.proxyProvider === 'scrapingbee' && process.env.SCRAPINGBEE_API_KEY) {
    const proxyUrl = new URL('https://app.scrapingbee.com/api/v1')
    proxyUrl.searchParams.set('api_key', process.env.SCRAPINGBEE_API_KEY)
    proxyUrl.searchParams.set('url', url)
    proxyUrl.searchParams.set('render_js', config.useHeadless ? 'true' : 'false')
    proxyUrl.searchParams.set('premium_proxy', 'true')
    const proxyRes = await fetch(proxyUrl.toString())
    if (proxyRes.ok) return await proxyRes.text()
  }

  if (config.proxyEnabled && config.proxyProvider === 'proxy_template') {
    const template = config.proxyUrlTemplate || process.env.SCRAPER_PROXY_URL_TEMPLATE || ''
    if (template.includes('{url}')) {
      const renderedUrl = template.replaceAll('{url}', encodeURIComponent(url))
      const proxyRes = await fetch(renderedUrl)
      if (proxyRes.ok) return await proxyRes.text()
    }
  }

  const firecrawlApiKey = process.env.FIRECRAWL_API_KEY
  if (firecrawlApiKey && config.useHeadless) {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${firecrawlApiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ['html'],
        onlyMainContent: false,
      }),
    })
    if (response.ok) {
      const data = (await response.json()) as { data?: { html?: string } }
      if (data?.data?.html) return data.data.html
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)
  try {
    const userAgents = [
      DEFAULT_USER_AGENT,
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    ]
    const selectedUserAgent = config.rotateUserAgent
      ? userAgents[Math.floor(Math.random() * userAgents.length)]
      : DEFAULT_USER_AGENT

    const response = await fetch(url, {
      headers: { 'User-Agent': selectedUserAgent, Accept: 'text/html,application/xhtml+xml' },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.text()
  } finally {
    clearTimeout(timeout)
  }
}

function extractContactsFromHtml(sourceUrl: string, html: string): ScrapeContact[] {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')

  const emails = Array.from(
    new Set((html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map((e) => e.toLowerCase()))
  )
  const phones = Array.from(
    new Set(html.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?){2}\d{4}/g) || [])
  )
  const company = findMetaContent(html, 'og:site_name') || guessCompanyFromTitle(html)
  const personHints = extractJsonLdPeople(html)
  const contextHints = buildContextHints(html)

  const contacts: ScrapeContact[] = []
  if (emails.length === 0 && phones.length === 0) return contacts

  for (let i = 0; i < Math.max(emails.length, phones.length, 1); i++) {
    const email = emails[i]
    const phone = phones[i]
    const context = findNearestContext(stripped, email || phone || '')
    const parsedName = parseNameFromContext(context) || personHints[i]?.name || null
    const parsedTitle = parseTitleFromContext(context) || personHints[i]?.jobTitle || contextHints.title || null
    const parsedCompany = personHints[i]?.worksFor || contextHints.company || company || null
    const splitName = splitFullName(parsedName)

    contacts.push({
      sourceUrl,
      email: email,
      phone: phone,
      firstName: splitName.firstName || undefined,
      lastName: splitName.lastName || undefined,
      title: parsedTitle || undefined,
      company: parsedCompany || undefined,
      rawData: {
        context,
        sampleText: stripped.slice(0, 500),
      },
    })
  }
  return contacts
}

function extractLinks(baseUrl: string, html: string): string[] {
  const links = new Set<string>()
  const hrefRegex = /href=["']([^"'#]+)["']/gi
  const matches = html.matchAll(hrefRegex)
  for (const match of matches) {
    const href = match[1]
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue
    const normalized = normalizeUrl(href, baseUrl)
    if (normalized) links.add(normalized)
  }
  return Array.from(links)
}

function dedupeContacts(contacts: ScrapeContact[]): ScrapeContact[] {
  const seen = new Set<string>()
  const result: ScrapeContact[] = []
  for (const contact of contacts) {
    const key = `${contact.email || ''}|${normalizePhone(contact.phone || '')}`
    if (key === '|') continue
    if (seen.has(key)) continue
    seen.add(key)
    result.push(contact)
  }
  return result
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

function normalizeUrl(url: string, base?: string): string | null {
  try {
    const parsed = base ? new URL(url, base) : new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) return null
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return null
  }
}

function findMetaContent(html: string, property: string): string | null {
  const regex = new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i')
  const match = html.match(regex)
  return match?.[1]?.trim() || null
}

function guessCompanyFromTitle(html: string): string | null {
  const match = html.match(/<title>(.*?)<\/title>/i)
  if (!match?.[1]) return null
  return match[1].split('|')[0].split('-')[0].trim() || null
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function isAllowedByRobots(pageUrl: string): Promise<boolean> {
  try {
    const parsed = new URL(pageUrl)
    const robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`
    const res = await fetch(robotsUrl)
    if (!res.ok) return true
    const text = (await res.text()).toLowerCase()
    const lines = text.split('\n').map((l) => l.trim())
    let inGlobalUserAgent = false
    const disallowed: string[] = []
    for (const line of lines) {
      if (line.startsWith('user-agent:')) {
        inGlobalUserAgent = line.includes('*')
      } else if (inGlobalUserAgent && line.startsWith('disallow:')) {
        const path = line.replace('disallow:', '').trim()
        if (path) disallowed.push(path)
      }
    }
    return !disallowed.some((path) => parsed.pathname.startsWith(path))
  } catch {
    return true
  }
}

function extractJsonLdPeople(html: string): Array<{ name?: string; jobTitle?: string; worksFor?: string }> {
  const result: Array<{ name?: string; jobTitle?: string; worksFor?: string }> = []
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  const matches = html.matchAll(regex)
  for (const match of matches) {
    const raw = match[1]?.trim()
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw) as unknown
      const nodes = Array.isArray(parsed) ? parsed : [parsed]
      for (const node of nodes) {
        const obj = node as Record<string, unknown>
        if (obj['@type'] === 'Person' || obj['@type'] === 'ContactPoint') {
          const worksForObj = obj.worksFor as Record<string, unknown> | undefined
          result.push({
            name: typeof obj.name === 'string' ? obj.name : undefined,
            jobTitle: typeof obj.jobTitle === 'string' ? obj.jobTitle : undefined,
            worksFor: worksForObj && typeof worksForObj.name === 'string' ? String(worksForObj.name) : undefined,
          })
        }
      }
    } catch {
      // no-op on bad JSON-LD
    }
  }
  return result
}

function buildContextHints(html: string): { company?: string; title?: string } {
  const title = findMetaContent(html, 'og:title') || findMetaContent(html, 'twitter:title') || undefined
  const company = findMetaContent(html, 'og:site_name') || guessCompanyFromTitle(html) || undefined
  return { company, title }
}

function findNearestContext(text: string, token: string): string {
  if (!token) return text.slice(0, 280)
  const idx = text.toLowerCase().indexOf(token.toLowerCase())
  if (idx < 0) return text.slice(0, 280)
  const start = Math.max(0, idx - 140)
  const end = Math.min(text.length, idx + token.length + 140)
  return text.slice(start, end)
}

function parseNameFromContext(context: string): string | null {
  const candidates = context.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g) || []
  return candidates.find((c) => c.split(' ').length >= 2) || null
}

function parseTitleFromContext(context: string): string | null {
  const titleRegex =
    /\b(Agent|Broker|Advisor|Producer|Consultant|Director|Manager|Owner|Founder|President|VP|Vice President|Underwriter)\b/i
  const match = context.match(titleRegex)
  return match?.[0] || null
}

function splitFullName(name: string | null): { firstName: string | null; lastName: string | null } {
  if (!name) return { firstName: null, lastName: null }
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return { firstName: parts[0], lastName: null }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}
