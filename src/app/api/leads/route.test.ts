import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Regression tests for t_cf1f4831 (HIGH): nameless-lead invisibility in
 * list/search. Defects pinned here:
 *  - M018/M019/M102: GET /api/leads had NO q-param handling, so q=<anything>
 *    was silently ignored — q=<non-matching string> returned the FULL list
 *    and company/email search never filtered.
 *  - M013: leads created with only email+company (null firstName/lastName)
 *    must remain visible in the default list and be findable by q=.
 *
 * The fake db below APPLIES the Prisma where clause (org / status / OR
 * contains-insensitive, null-safe) instead of returning canned rows, so a
 * regression that drops or ignores q genuinely fails these tests.
 */

type FakeLead = {
  id: string
  organizationId: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  company: string | null
  status: string
  createdAt: Date
  tags: unknown[]
}

const ORG = 'org_1'

function seedLeads(): FakeLead[] {
  return [
    {
      id: 'lead-named',
      organizationId: ORG,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@analytical.io',
      phone: '+15550101',
      company: 'Analytical Engines',
      status: 'new',
      createdAt: new Date('2026-09-01T00:00:00Z'),
      tags: [],
    },
    {
      // Nameless lead: exactly what a quick "add lead" or a CSV import
      // without a name column produces.
      id: 'lead-nameless',
      organizationId: ORG,
      firstName: null,
      lastName: null,
      email: 'nameless@zebrazeta.io',
      phone: null,
      company: 'ZebraZeta Corp',
      status: 'new',
      createdAt: new Date('2026-09-02T00:00:00Z'),
      tags: [],
    },
    {
      id: 'lead-other-org',
      organizationId: 'org_other',
      firstName: 'Mallory',
      lastName: 'Outsider',
      email: 'mallory@other.io',
      phone: null,
      company: 'Other Org Inc',
      status: 'new',
      createdAt: new Date('2026-09-03T00:00:00Z'),
      tags: [],
    },
  ]
}

type ContainsCondition = { contains: string; mode?: string }
type OrClause = Record<string, ContainsCondition>
type AndEntry = { OR: OrClause[] }
type FakeWhere = {
  organizationId?: string
  status?: string
  OR?: OrClause[]
  AND?: AndEntry[]
}

function matchesCondition(row: FakeLead, condition: OrClause): boolean {
  return Object.entries(condition).every(([field, cond]) => {
    const value = (row as unknown as Record<string, unknown>)[field]
    if (typeof value !== 'string') return false // null-safe: null field never matches
    if (cond.mode === 'insensitive') {
      return value.toLowerCase().includes(cond.contains.toLowerCase())
    }
    return value.includes(cond.contains)
  })
}

function applyWhere(rows: FakeLead[], where: FakeWhere): FakeLead[] {
  return rows.filter((row) => {
    if (where.organizationId !== undefined && row.organizationId !== where.organizationId) return false
    if (where.status !== undefined && row.status !== where.status) return false
    if (Array.isArray(where.OR) && where.OR.length > 0) {
      if (!where.OR.some((clause) => matchesCondition(row, clause))) return false
    }
    // AND of ORs: every term-group must match at least one field (tokenized q)
    if (Array.isArray(where.AND) && where.AND.length > 0) {
      if (!where.AND.every((entry) => entry.OR.some((clause) => matchesCondition(row, clause)))) {
        return false
      }
    }
    return true
  })
}

let store: FakeLead[] = []

const mockDb = vi.hoisted(() => ({
  lead: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({
  db: mockDb,
}))

vi.mock('@/lib/request-context', () => ({
  withRequestOrgContext: vi.fn(
    async (
      _request: NextRequest,
      handler: (context: { organizationId: string; userId: string | null }) => Promise<unknown>,
    ) => handler({ organizationId: 'org_1', userId: null }),
  ),
}))

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn(() => null),
}))

import { GET } from './route'

function getList(url: string) {
  return GET(new NextRequest(url)) as Promise<Response>
}

describe('GET /api/leads — nameless-lead visibility + q search (t_cf1f4831)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    store = seedLeads()

    mockDb.lead.findMany.mockImplementation(
      async (args: { where?: FakeWhere; take?: number; skip?: number }) => {
        const rows = applyWhere(store, args?.where ?? {})
        const sorted = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        const skip = args?.skip ?? 0
        const take = args?.take ?? sorted.length
        return sorted.slice(skip, skip + take).map((row) => ({ ...row, tags: [] }))
      },
    )
    mockDb.lead.count.mockImplementation(async (args: { where?: FakeWhere }) => {
      return applyWhere(store, args?.where ?? {}).length
    })
  })

  it('(a) nameless lead (email+company only) appears in the default list', async () => {
    const response = await getList('http://localhost/api/leads')
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.total).toBe(2)
    expect(json.leads).toHaveLength(2)
    const nameless = json.leads.find((l: { id: string }) => l.id === 'lead-nameless')
    expect(nameless).toBeDefined()
    expect(nameless.firstName).toBeNull()
    expect(nameless.lastName).toBeNull()
    expect(nameless.email).toBe('nameless@zebrazeta.io')
    expect(nameless.company).toBe('ZebraZeta Corp')
  })

  it('(a2) default list never leaks other organizations’ leads', async () => {
    const response = await getList('http://localhost/api/leads')
    const json = await response.json()
    expect(json.leads.some((l: { id: string }) => l.id === 'lead-other-org')).toBe(false)
  })

  it('(b) q=<company of nameless lead> finds exactly that lead', async () => {
    const response = await getList('http://localhost/api/leads?q=ZebraZeta')
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.total).toBe(1)
    expect(json.leads).toHaveLength(1)
    expect(json.leads[0].id).toBe('lead-nameless')
  })

  it('(b2) q=<email of nameless lead> finds exactly that lead, case-insensitively', async () => {
    const response = await getList(
      `http://localhost/api/leads?q=${encodeURIComponent('NAMELESS@ZEBRAZETA.IO')}`,
    )
    const json = await response.json()

    expect(json.total).toBe(1)
    expect(json.leads[0].id).toBe('lead-nameless')
  })

  it('(b3) q=<name of named lead> finds exactly that lead', async () => {
    const response = await getList('http://localhost/api/leads?q=lovelace')
    const json = await response.json()

    expect(json.total).toBe(1)
    expect(json.leads[0].id).toBe('lead-named')
  })

  it('(b4) q=<firstName> finds exactly that lead', async () => {
    const response = await getList('http://localhost/api/leads?q=ada')
    const json = await response.json()

    expect(json.total).toBe(1)
    expect(json.leads[0].id).toBe('lead-named')
  })

  it('(b5) q=<phone fragment> finds exactly that lead', async () => {
    const response = await getList('http://localhost/api/leads?q=5550101')
    const json = await response.json()

    expect(json.total).toBe(1)
    expect(json.leads[0].id).toBe('lead-named')
  })

  it('(b6) q=<full name "Ada Lovelace"> finds the lead (tokenized AND-of-ORs)', async () => {
    const response = await getList(
      `http://localhost/api/leads?q=${encodeURIComponent('Ada Lovelace')}`,
    )
    const json = await response.json()

    expect(json.total).toBe(1)
    expect(json.leads[0].id).toBe('lead-named')
  })

  it('(b7) q=<terms spanning two leads> matches neither (every term must hit the same row)', async () => {
    const response = await getList(
      `http://localhost/api/leads?q=${encodeURIComponent('ada zebrazeta')}`,
    )
    const json = await response.json()

    expect(json.total).toBe(0)
    expect(json.leads).toHaveLength(0)
  })

  it('(c) q=<non-matching string> returns an empty list even though leads exist', async () => {
    const response = await getList('http://localhost/api/leads?q=qqqqnomatchzzzz')
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.leads).toHaveLength(0)
    expect(json.total).toBe(0)
    expect(json.hasMore).toBe(false)
    // leads really do exist in this org — the empty result must come from filtering
    expect(store.filter((l) => l.organizationId === ORG)).toHaveLength(2)
  })

  it('(c2) q=whitespace-only is treated as no filter (full org list)', async () => {
    const response = await getList('http://localhost/api/leads?q=%20%20')
    const json = await response.json()

    expect(json.total).toBe(2)
    expect(json.leads).toHaveLength(2)
  })

  it('q composes with status filter', async () => {
    store[1].status = 'contacted'
    const response = await getList('http://localhost/api/leads?q=zebrazeta&status=new')
    const json = await response.json()

    expect(json.total).toBe(0)
    expect(json.leads).toHaveLength(0)
  })
})
