import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { zaiChatJson } from '@/lib/zai'
import { buildKnowledgeCitations, type KnowledgeCitation, type PlaybookCitation } from './citations'
import { trackAIEvent } from '@/lib/ai-tracking'

const carrierPlaybookSchema = z.object({
  leadId: z.string().min(1),
  extraContext: z.string().max(4000).optional().default(''),
})

type PlaybookResponse = {
  recommendedCarrier: {
    id: string | null
    name: string
    rationale: string
    confidence: number
  }
  backupCarriers: Array<{
    id: string | null
    name: string
    rationale: string
  }>
  suggestedPlanType: string
  qualificationSummary: string[]
  objectionHandling: string[]
  followUpScripts: {
    callOpening: string
    sms: string
    emailSubject: string
    emailBody: string
  }
  nextActions: string[]
  citations: PlaybookCitation[]
}

function safeJsonParse<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T
  } catch {
    return null
  }
}

function fallbackPlaybook(lead: {
  id: string
  firstName: string | null
  lastName: string | null
  status: string
  aiScore: number
  company: string | null
  title: string | null
  source: string | null
  aiNextAction: string | null
}, carriers: Array<{ id: string; name: string }>): PlaybookResponse {
  const primary = carriers[0]
  const backup = carriers.slice(1, 3)
  const fullName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'this lead'
  const scoreBand = lead.aiScore >= 85 ? 'high-intent' : lead.aiScore >= 65 ? 'mid-intent' : 'early-intent'

  return {
    recommendedCarrier: {
      id: primary?.id || null,
      name: primary?.name || 'General Carrier Match',
      rationale: `Best available match from current carrier library for a ${scoreBand} profile based on lead status, role, and available underwriting docs.`,
      confidence: Math.max(0.55, Math.min(0.9, 0.55 + lead.aiScore / 200)),
    },
    backupCarriers: backup.map((c) => ({
      id: c.id,
      name: c.name,
      rationale: 'Keep as fallback if underwriting fit or pricing alignment is stronger during discovery.',
    })),
    suggestedPlanType: 'Life + health protection bundle (to be finalized after underwriting Q&A)',
    qualificationSummary: [
      `Lead status: ${lead.status}`,
      `AI score: ${lead.aiScore}`,
      lead.company ? `Company context: ${lead.company}` : 'Company context pending',
      lead.title ? `Role context: ${lead.title}` : 'Role context pending',
      lead.source ? `Lead source: ${lead.source}` : 'Lead source unknown',
    ],
    objectionHandling: [
      'Price concern: compare total protection value and long-term cost of waiting.',
      'Need to think about it: book a firm follow-up and summarize key risk gaps now.',
      'Already have coverage: position this as a coverage-gap review, not a replacement pitch.',
    ],
    followUpScripts: {
      callOpening: `Hey ${lead.firstName || 'there'}, this is your broker following up with a quick strategy based on your profile. I found a carrier-plan fit that may reduce risk exposure while keeping underwriting realistic. Can I take 2 minutes to walk you through it?`,
      sms: `Hi ${lead.firstName || ''}, quick update: I mapped your profile to a strong carrier option and a backup plan if underwriting shifts. Want me to send the summary before our call?`,
      emailSubject: `Your tailored coverage strategy options`,
      emailBody: `Hi ${fullName},\n\nI reviewed your profile and prepared a recommended carrier strategy plus backup options based on qualification signals and underwriting fit.\n\nIf helpful, I can walk you through the recommended route and why it is likely to be the best match.\n\nBest,\nYour Broker`,
    },
    nextActions: [
      'Run underwriting checklist questions and update lead notes.',
      'Send SMS summary and request preferred call slot.',
      lead.aiNextAction || 'Execute the next best follow-up in CRM.',
    ],
    citations: [],
  }
}

type RetrievedChunk = {
  score: number
  carrierId: string | null
  carrierName: string
  documentId: string
  documentName: string
  chunkIndex: number
  content: string
}

function isRetrievedChunk(value: RetrievedChunk | null): value is RetrievedChunk {
  return value !== null
}
function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]{3,}/g) || []).slice(0, 500)
}

function buildLeadQueryText(lead: {
  firstName: string | null
  lastName: string | null
  company: string | null
  title: string | null
  status: string
  source: string | null
  aiNextAction: string | null
  notes: Array<{ content: string }>
  activities: Array<{ title: string; description: string | null; type: string }>
}) {
  const notesText = lead.notes.map((n) => n.content).join(' ')
  const activityText = lead.activities
    .map((a) => `${a.type} ${a.title} ${a.description || ''}`.trim())
    .join(' ')

  return [
    lead.firstName,
    lead.lastName,
    lead.company,
    lead.title,
    lead.status,
    lead.source,
    lead.aiNextAction,
    notesText,
    activityText,
  ]
    .filter(Boolean)
    .join(' ')
}

function retrieveTopChunks(
  queryText: string,
  chunks: Array<{
    chunkIndex: number
    content: string
    carrierDocument: {
      id: string
      name: string
      carrier: { id: string; name: string }
    }
  }>
): RetrievedChunk[] {
  const queryTokens = tokenize(queryText)
  if (queryTokens.length === 0) return []
  const queryTokenSet = new Set(queryTokens)

  const scored = chunks
    .map<RetrievedChunk | null>((chunk) => {
      const chunkTokens = tokenize(chunk.content)
      if (chunkTokens.length === 0) return null
      let overlap = 0
      for (const token of chunkTokens) {
        if (queryTokenSet.has(token)) overlap++
      }
      const uniqueOverlap = overlap / Math.max(1, new Set(chunkTokens).size)
      const boost = /underwriting|eligibility|knockout|decline|risk class|prescription|bmi|tobacco|age/i.test(chunk.content)
        ? 0.05
        : 0
      const score = uniqueOverlap + boost
      if (score <= 0) return null

      return {
        score,
        carrierId: chunk.carrierDocument.carrier.id,
        carrierName: chunk.carrierDocument.carrier.name,
        documentId: chunk.carrierDocument.id,
        documentName: chunk.carrierDocument.name,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
      }
    })
    .filter(isRetrievedChunk)

  scored.sort((a, b) => b.score - a.score)

  return scored
    .filter((item) => item.score >= 0.02 && item.content.length >= 60)
    .slice(0, 8)
}

function calibrateConfidence(baseLeadScore: number, evidenceCount: number, topEvidenceScore: number): number {
  const scoreSignal = Math.max(0.45, Math.min(0.9, 0.45 + baseLeadScore / 220))
  const evidenceSignal = Math.min(0.2, evidenceCount * 0.03)
  const qualitySignal = Math.min(0.12, Math.max(0, topEvidenceScore) * 0.8)
  return Math.max(0.5, Math.min(0.96, scoreSignal + evidenceSignal + qualitySignal))
}

function normalizeCitations(
  citations: PlaybookResponse['citations'] | undefined,
  knowledgeContext: KnowledgeCitation[]
): PlaybookResponse['citations'] {
  const filteredCitations = (Array.isArray(citations) ? citations : [])
    .filter((citation) => typeof citation.snippet === 'string' && citation.snippet.trim().length >= 50)
    .slice(0, 6)

  if (filteredCitations.length > 0) return filteredCitations
  return buildKnowledgeCitations(knowledgeContext)
}

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'carrier-playbook', limit: 30, windowMs: 60_000 })
    if (limited) return limited
    return withRequestOrgContext(request, async (context) => {
    const parsedBody = await parseJsonBody(request, carrierPlaybookSchema)
    if (!parsedBody.success) return parsedBody.response
    const { leadId, extraContext } = parsedBody.data

    const lead = await db.lead.findFirst({
      where: { id: leadId, organizationId: context.organizationId },
      include: {
        notes: {
          orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
          take: 8,
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 12,
        },
      },
    })

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const carriers = await db.carrier.findMany({
      where: { organizationId: context.organizationId },
      include: {
        documents: {
          orderBy: { createdAt: 'desc' },
          take: 30,
        },
      },
      orderBy: { name: 'asc' },
      take: 20,
    })

    if (carriers.length === 0) {
      return NextResponse.json({
        error: 'No carriers configured yet. Add carriers and underwriting documents first.',
      }, { status: 400 })
    }

    const compactLead = {
      id: lead.id,
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      title: lead.title,
      source: lead.source,
      status: lead.status,
      aiScore: lead.aiScore,
      aiNextAction: lead.aiNextAction,
      estimatedValue: lead.estimatedValue,
      customFields: lead.customFields,
      aiInsights: lead.aiInsights,
      notes: lead.notes.map((n) => n.content).slice(0, 8),
      activities: lead.activities.map((a) => ({
        type: a.type,
        title: a.title,
        description: a.description,
      })),
    }

    const compactCarriers = carriers.map((carrier) => ({
      id: carrier.id,
      name: carrier.name,
      website: carrier.website,
      notes: carrier.notes,
      documents: carrier.documents.map((doc) => ({
        id: doc.id,
        type: doc.type,
        name: doc.name,
        description: doc.description,
        version: doc.version,
      })),
    }))

    const candidateChunks = await db.carrierDocumentChunk.findMany({
      where: {
        organizationId: context.organizationId,
        carrierDocument: {
          carrier: {
            organizationId: context.organizationId,
          },
        },
      },
      include: {
        carrierDocument: {
          select: {
            id: true,
            name: true,
            carrier: {
              select: { id: true, name: true },
            },
          },
        },
      },
      take: 600,
      orderBy: { createdAt: 'desc' },
    })

    const leadQueryText = buildLeadQueryText({
      firstName: lead.firstName,
      lastName: lead.lastName,
      company: lead.company,
      title: lead.title,
      status: lead.status,
      source: lead.source,
      aiNextAction: lead.aiNextAction,
      notes: lead.notes,
      activities: lead.activities.map((a) => ({
        title: a.title,
        description: a.description,
        type: a.type,
      })),
    })
    const topChunks = retrieveTopChunks(
      leadQueryText,
      candidateChunks.map((c) => ({
        chunkIndex: c.chunkIndex,
        content: c.content,
        carrierDocument: {
          id: c.carrierDocument.id,
          name: c.carrierDocument.name,
          carrier: c.carrierDocument.carrier,
        },
      }))
    )

    const knowledgeContext = topChunks.map((chunk, idx) => ({
      citationId: idx + 1,
      carrierId: chunk.carrierId,
      carrierName: chunk.carrierName,
      documentId: chunk.documentId,
      documentName: chunk.documentName,
      chunkIndex: chunk.chunkIndex,
      snippet: chunk.content.slice(0, 700),
    }))

    const prompt = `You are an elite life and health insurance broker assistant.
Given lead qualification context plus carrier underwriting materials metadata and retrieved underwriting snippets, return:
1) best carrier recommendation
2) backup carriers
3) suggested plan type
4) qualification summary bullets
5) objection handling bullets
6) personalized follow-up scripts (call opening, SMS, email subject/body)
7) immediate next actions

Lead context:
${JSON.stringify(compactLead)}

Carrier library context:
${JSON.stringify(compactCarriers)}

Retrieved underwriting snippets (use these for grounded recommendations):
${JSON.stringify(knowledgeContext)}

Additional broker context:
${extraContext || 'N/A'}

Respond as strict JSON only using this schema:
{
  "recommendedCarrier": { "id": "string|null", "name": "string", "rationale": "string", "confidence": 0.0 },
  "backupCarriers": [{ "id": "string|null", "name": "string", "rationale": "string" }],
  "suggestedPlanType": "string",
  "qualificationSummary": ["string"],
  "objectionHandling": ["string"],
  "followUpScripts": {
    "callOpening": "string",
    "sms": "string",
    "emailSubject": "string",
    "emailBody": "string"
  },
  "nextActions": ["string"],
  "citations": [{
    "carrierId": "string|null",
    "carrierName": "string",
    "documentId": "string",
    "documentName": "string",
    "chunkIndex": 0,
    "snippet": "string"
  }]
}`

    try {
      const content = (await zaiChatJson(prompt)) || ''
      const jsonCandidate = content.match(/\{[\s\S]*\}/)?.[0] || ''
      const parsed = safeJsonParse<PlaybookResponse>(jsonCandidate)

      if (parsed && parsed.recommendedCarrier?.name && parsed.followUpScripts?.sms) {
        parsed.recommendedCarrier.confidence = calibrateConfidence(
          lead.aiScore,
          topChunks.length,
          topChunks[0]?.score || 0
        )
        parsed.citations = normalizeCitations(parsed.citations, knowledgeContext)

        // Track playbook generation
        await trackAIEvent(
          context.userId || 'unknown',
          'playbook_generated',
          'lead',
          leadId,
          { leadId, extraContext },
          { playbook: parsed, source: 'llm' },
          { leadProfession: lead.title || undefined }
        ).catch(console.error)

        return NextResponse.json({ playbook: parsed, source: 'llm' })
      }
    } catch (error) {
      console.error('Carrier playbook LLM fallback triggered:', error)
    }

    const fallback = fallbackPlaybook(
      {
        id: lead.id,
        firstName: lead.firstName,
        lastName: lead.lastName,
        status: lead.status,
        aiScore: lead.aiScore,
        company: lead.company,
        title: lead.title,
        source: lead.source,
        aiNextAction: lead.aiNextAction,
      },
      carriers.map((c) => ({ id: c.id, name: c.name }))
    )
    fallback.citations = normalizeCitations(undefined, knowledgeContext)
    fallback.recommendedCarrier.confidence = calibrateConfidence(
      lead.aiScore,
      topChunks.length,
      topChunks[0]?.score || 0
    )

    // Track fallback playbook generation
    await trackAIEvent(
      context.userId || 'unknown',
      'playbook_generated',
      'lead',
      leadId,
      { leadId, extraContext },
      { playbook: fallback, source: 'fallback' },
      { leadProfession: lead.title || undefined }
    ).catch(console.error)

    return NextResponse.json({ playbook: fallback, source: 'fallback' })
    })
  } catch (error) {
    console.error('Carrier playbook error:', error)
    return NextResponse.json({ error: 'Failed to generate carrier playbook' }, { status: 500 })
  }
}
