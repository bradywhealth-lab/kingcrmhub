import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { enforceRateLimit } from '@/lib/rate-limit'

const FIELD_ALIASES: Record<string, string[]> = {
  firstName: ['firstname', 'first', 'givenname', 'fname'],
  lastName: ['lastname', 'last', 'surname', 'lname'],
  email: ['email', 'emailaddress', 'workemail'],
  phone: ['phone', 'phonenumber', 'mobile', 'cell'],
  company: ['company', 'companyname', 'business', 'organization'],
  title: ['title', 'jobtitle', 'role', 'position'],
  website: ['website', 'site', 'domain', 'url'],
  linkedin: ['linkedin', 'linkedinurl', 'linkedinprofile'],
  estimatedValue: ['estimatedvalue', 'value', 'dealvalue', 'annualpremium'],
  address: ['address', 'street', 'streetaddress', 'addr'],
  city: ['city', 'town', 'municipality'],
  state: ['state', 'province', 'region', 'st'],
  zip: ['zip', 'zipcode', 'postalcode', 'postcode', 'postal'],
}
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const ALLOWED_CSV_MIME_TYPES = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'text/plain',
  'application/octet-stream',
])

type ParsedCsv = {
  headers: string[]
  rows: string[][]
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normalizeEmail(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase()
  return trimmed || null
}

function normalizePhone(value: string | null | undefined): string | null {
  const digits = (value || '').replace(/\D/g, '')
  return digits || null
}

function parseCurrency(value: string): number | null {
  const cleaned = value.replace(/[^0-9.-]/g, '').trim()
  if (!cleaned) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function parseCsv(text: string): ParsedCsv {
  const rows: string[][] = []
  let currentCell = ''
  let currentRow: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentCell)
      currentCell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++
      currentRow.push(currentCell)
      if (currentRow.some((cell) => cell.trim().length > 0)) {
        rows.push(currentRow.map((cell) => cell.trim()))
      }
      currentRow = []
      currentCell = ''
      continue
    }

    currentCell += char
  }

  currentRow.push(currentCell)
  if (currentRow.some((cell) => cell.trim().length > 0)) {
    rows.push(currentRow.map((cell) => cell.trim()))
  }

  if (rows.length === 0) {
    return { headers: [], rows: [] }
  }

  const headers = rows[0]
  const dataRows = rows.slice(1)
  return { headers, rows: dataRows }
}

function buildColumnIndexes(headers: string[]): Record<string, number | null> {
  const normalizedHeaders = headers.map(normalizeHeader)
  const mapping: Record<string, number | null> = {}

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const index = normalizedHeaders.findIndex((header) => aliases.includes(header))
    mapping[field] = index >= 0 ? index : null
  }

  return mapping
}

function getCell(row: string[], mapping: Record<string, number | null>, field: string): string {
  const index = mapping[field]
  if (index == null || index >= row.length) return ''
  return row[index]?.trim() || ''
}

function calculateUploadLeadScore(input: {
  email: string | null
  phone: string | null
  company: string | null
  title: string | null
  website: string | null
  linkedin: string | null
  estimatedValue: number | null
  source: string
}): number {
  let score = 25

  if (input.email) {
    const domain = input.email.split('@')[1]
    if (domain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'].includes(domain)) score += 14
    score += 4
  }
  if (input.phone) score += 9
  if (input.company) score += 8
  if (input.website) score += 4
  if (input.linkedin) score += 6

  if (input.title) {
    const titleLower = input.title.toLowerCase()
    score += ['ceo', 'cfo', 'coo', 'vp', 'director', 'owner', 'founder', 'broker', 'advisor'].some((term) =>
      titleLower.includes(term)
    )
      ? 14
      : 6
  }

  if (input.estimatedValue) {
    if (input.estimatedValue > 100000) score += 12
    else if (input.estimatedValue > 50000) score += 9
    else if (input.estimatedValue > 10000) score += 5
  }

  const sourceScores: Record<string, number> = {
    referral: 14,
    linkedin: 10,
    website: 8,
    google: 5,
    facebook: 3,
    scrape: 6,
    manual: 2,
    booking: 10,
    csv_upload: 2,
  }

  score += sourceScores[input.source] || 0
  return Math.min(100, Math.max(0, score))
}

export async function GET(request: NextRequest) {
  try {
    return withRequestOrgContext(request, async (context) => {
      const limit = Math.max(1, Math.min(200, Number(request.nextUrl.searchParams.get('limit') || '50')))
      const uploads = await db.cSVUpload.findMany({
        where: { organizationId: context.organizationId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
      return NextResponse.json({ uploads })
    })
  } catch (error) {
    console.error('Upload history GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch uploads' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'upload-create', limit: 30, windowMs: 60_000 })
    if (limited) return limited

    return withRequestOrgContext(request, async (context) => {
      const formData = await request.formData()
      const file = formData.get('file')
      const source = String(formData.get('source') || 'csv_upload').trim() || 'csv_upload'
      const aiAutoScore = String(formData.get('aiAutoScore') || 'true').trim().toLowerCase() !== 'false'

      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'file is required' }, { status: 400 })
      }

      if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json({ error: 'CSV file must be between 1B and 10MB' }, { status: 400 })
      }

      if (!file.name.toLowerCase().endsWith('.csv')) {
        return NextResponse.json({ error: 'Only .csv files are supported' }, { status: 400 })
      }

      // Only reject if MIME type is set AND is clearly not CSV-like.
      // Browsers vary widely in MIME types for .csv (octet-stream, text/csv, etc.).
      // The .csv extension check above is the primary guard.
      if (file.type && !ALLOWED_CSV_MIME_TYPES.has(file.type.toLowerCase())) {
        // Allow any text/* type as well
        if (!file.type.toLowerCase().startsWith('text/')) {
          return NextResponse.json({ error: 'Invalid CSV file type' }, { status: 400 })
        }
      }

      const csvText = await file.text()
      const parsed = parseCsv(csvText)
      if (parsed.headers.length === 0) {
        return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 })
      }

      const columnIndexes = buildColumnIndexes(parsed.headers)
      const hasNameColumn = columnIndexes.firstName != null || columnIndexes.lastName != null
      const hasPhoneColumn = columnIndexes.phone != null
      if (!hasNameColumn && !hasPhoneColumn) {
        return NextResponse.json({ error: 'CSV must include a Name (first or last) or Phone column' }, { status: 400 })
      }

      const upload = await db.cSVUpload.create({
        data: {
          organizationId: context.organizationId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || 'text/csv',
          uploadedBy: context.userId,
          status: 'processing',
          totalRows: parsed.rows.length,
          aiAutoScored: aiAutoScore,
          defaultSource: source,
          columnMapping: Object.fromEntries(
            Object.entries(columnIndexes).map(([field, index]) => [field, index == null ? null : parsed.headers[index]])
          ) as Prisma.InputJsonValue,
        },
      })

      // --- Pre-load existing emails/phones for duplicate detection ---
      const existingLeads = await db.lead.findMany({
        where: { organizationId: context.organizationId },
        select: { email: true, phone: true },
      })

      const knownEmails = new Set(existingLeads.map((lead) => normalizeEmail(lead.email)).filter(Boolean) as string[])
      const knownPhones = new Set(existingLeads.map((lead) => normalizePhone(lead.phone)).filter(Boolean) as string[])

      // --- Phase 1: Validate all rows and build insert-ready batch ---
      const errors: Array<{ rowNumber: number; message: string }> = []
      const warnings: Array<{ rowNumber: number; message: string }> = []
      let duplicateRows = 0
      let failedRows = 0

      const validLeads: Prisma.LeadCreateManyInput[] = []

      for (const [index, row] of parsed.rows.entries()) {
        const rowNumber = index + 2
        const email = normalizeEmail(getCell(row, columnIndexes, 'email'))
        const phone = normalizePhone(getCell(row, columnIndexes, 'phone'))

        const firstNameVal = getCell(row, columnIndexes, 'firstName')
        const lastNameVal = getCell(row, columnIndexes, 'lastName')
        const hasName = !!(firstNameVal || lastNameVal)
        if (!hasName && !phone) {
          failedRows++
          errors.push({ rowNumber, message: 'Missing both name and phone' })
          continue
        }

        if ((email && knownEmails.has(email)) || (phone && knownPhones.has(phone))) {
          duplicateRows++
          warnings.push({ rowNumber, message: 'Duplicate lead skipped' })
          continue
        }

        const firstName = firstNameVal || null
        const lastName = lastNameVal || null
        const company = getCell(row, columnIndexes, 'company') || null
        const address = getCell(row, columnIndexes, 'address') || null
        const city = getCell(row, columnIndexes, 'city') || null
        const state = getCell(row, columnIndexes, 'state') || null
        const zip = getCell(row, columnIndexes, 'zip') || null
        const title = getCell(row, columnIndexes, 'title') || null
        const website = getCell(row, columnIndexes, 'website') || null
        const linkedin = getCell(row, columnIndexes, 'linkedin') || null
        const estimatedValue = parseCurrency(getCell(row, columnIndexes, 'estimatedValue'))
        const aiScore = aiAutoScore
          ? calculateUploadLeadScore({ email, phone, company, title, website, linkedin, estimatedValue, source })
          : 0

        validLeads.push({
          organizationId: context.organizationId,
          firstName,
          lastName,
          email,
          phone,
          company,
          address,
          city,
          state,
          zip,
          title,
          website,
          linkedin,
          source,
          status: 'new',
          estimatedValue,
          csvUploadId: upload.id,
          rowNumber,
          aiScore,
          aiConfidence: aiAutoScore ? Math.min(0.98, Math.max(0.6, 0.72 + aiScore / 500)) : null,
          aiLastAnalyzed: aiAutoScore ? new Date() : null,
          aiNextAction: aiAutoScore
            ? aiScore >= 85
              ? 'Call today and push for appointment booking'
              : aiScore >= 70
                ? 'Send personalized outreach and propose 2 call slots'
                : 'Qualify this lead with AI questionnaire and initial contact'
            : null,
        })

        // Track in memory so later rows in this file detect intra-file duplicates
        if (email) knownEmails.add(email)
        if (phone) knownPhones.add(phone)
      }

      // --- Phase 2: Chunked batch insert with createMany ---
      const CHUNK_SIZE = 200
      let successfulRows = 0
      const chunkErrors: Array<{ chunkStart: number; message: string }> = []

      for (let i = 0; i < validLeads.length; i += CHUNK_SIZE) {
        const chunk = validLeads.slice(i, i + CHUNK_SIZE)
        try {
          const result = await db.lead.createMany({
            data: chunk,
            skipDuplicates: true,
          })
          successfulRows += result.count
        } catch (chunkError) {
          // Chunk failed — fall back to individual inserts to isolate bad rows
          for (const lead of chunk) {
            try {
              await db.lead.create({ data: lead })
              successfulRows++
            } catch (rowError) {
              failedRows++
              errors.push({
                rowNumber: lead.rowNumber ?? 0,
                message: rowError instanceof Error ? rowError.message.slice(0, 200) : 'Insert failed',
              })
            }
          }
        }

        // Update progress after each chunk so the UI can reflect it
        await db.cSVUpload.update({
          where: { id: upload.id },
          data: {
            processedRows: Math.min(i + CHUNK_SIZE, validLeads.length) + failedRows + duplicateRows,
            successfulRows,
          },
        })
      }

      // --- Phase 3: Finalize upload record ---
      const updatedUpload = await db.cSVUpload.update({
        where: { id: upload.id },
        data: {
          status: successfulRows > 0 || duplicateRows > 0 ? 'completed' : 'failed',
          processedRows: parsed.rows.length,
          successfulRows,
          failedRows,
          duplicateRows,
          errors: errors.length > 0 ? (errors as Prisma.InputJsonValue) : undefined,
          warnings: warnings.length > 0 ? (warnings as Prisma.InputJsonValue) : undefined,
          completedAt: new Date(),
        },
      })

      return NextResponse.json({
        upload: updatedUpload,
        message: `Imported ${successfulRows} leads from ${file.name}`,
      })
    })
  } catch (error) {
    console.error('Upload POST error:', error)
    return NextResponse.json({ error: 'Failed to import CSV upload' }, { status: 500 })
  }
}
