import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { enforceRateLimit } from '@/lib/rate-limit'

const LEAD_FIELD_ALIASES: Record<string, string> = {
  first_name: 'firstName',
  firstname: 'firstName',
  'first name': 'firstName',
  last_name: 'lastName',
  lastname: 'lastName',
  'last name': 'lastName',
  email: 'email',
  email_address: 'email',
  'email address': 'email',
  phone: 'phone',
  phone_number: 'phone',
  'phone number': 'phone',
  telephone: 'phone',
  mobile: 'phone',
  company: 'company',
  company_name: 'company',
  'company name': 'company',
  organization: 'company',
  title: 'title',
  job_title: 'title',
  'job title': 'title',
  position: 'title',
  role: 'title',
  website: 'website',
  url: 'website',
  linkedin: 'linkedin',
  linkedin_url: 'linkedin',
  address: 'address',
  street: 'address',
  city: 'city',
  state: 'state',
  province: 'state',
  zip: 'zip',
  zipcode: 'zip',
  zip_code: 'zip',
  postal_code: 'zip',
  country: 'country',
  source: 'source',
  lead_source: 'source',
  'lead source': 'source',
  value: 'estimatedValue',
  estimated_value: 'estimatedValue',
  'estimated value': 'estimatedValue',
  deal_value: 'estimatedValue',
}

const VALID_LEAD_FIELDS = new Set([
  'firstName', 'lastName', 'email', 'phone', 'company', 'title',
  'website', 'linkedin', 'address', 'city', 'state', 'zip', 'country',
  'source', 'estimatedValue',
])

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return { headers: [], rows: [] }

  const parseLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map(parseLine)
  return { headers, rows }
}

function resolveColumnMapping(headers: string[]): Record<number, string> {
  const mapping: Record<number, string> = {}
  for (let i = 0; i < headers.length; i++) {
    const normalized = headers[i].toLowerCase().trim()
    const mapped = LEAD_FIELD_ALIASES[normalized]
    if (mapped && VALID_LEAD_FIELDS.has(mapped)) {
      mapping[i] = mapped
    }
  }
  return mapping
}

export async function GET(request: NextRequest) {
  try {
    return withRequestOrgContext(request, async (context) => {
    const { searchParams } = new URL(request.url)
    const limit = Math.max(1, Math.min(100, Number(searchParams.get('limit') || '50')))

    const uploads = await db.cSVUpload.findMany({
      where: { organizationId: context.organizationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({
      uploads: uploads.map((u) => ({
        id: u.id,
        fileName: u.fileName,
        fileSize: u.fileSize,
        totalRows: u.totalRows,
        successfulRows: u.successfulRows,
        duplicateRows: u.duplicateRows,
        failedRows: u.failedRows,
        status: u.status,
        createdAt: u.createdAt.toISOString(),
        aiAutoScored: u.aiAutoScored,
      })),
    })
    })
  } catch (error) {
    console.error('Upload GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch uploads' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'upload-csv', limit: 20, windowMs: 60_000 })
    if (limited) return limited
    return withRequestOrgContext(request, async (context) => {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const defaultSource = (formData.get('source') as string) || 'csv_upload'
    const aiAutoScore = formData.get('aiAutoScore') === 'true'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      return NextResponse.json({ error: 'Only CSV files are supported' }, { status: 400 })
    }

    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 })
    }

    const text = await file.text()
    const { headers, rows } = parseCSV(text)

    if (headers.length === 0 || rows.length === 0) {
      return NextResponse.json({ error: 'CSV file is empty or has no data rows' }, { status: 400 })
    }

    const columnMapping = resolveColumnMapping(headers)
    const mappedFieldCount = Object.keys(columnMapping).length
    if (mappedFieldCount === 0) {
      return NextResponse.json({
        error: 'Could not auto-map any columns. Expected headers like: first_name, last_name, email, phone, company, title, source, etc.',
      }, { status: 400 })
    }

    const upload = await db.cSVUpload.create({
      data: {
        organizationId: context.organizationId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'text/csv',
        status: 'processing',
        totalRows: rows.length,
        columnMapping,
        defaultSource: defaultSource,
        aiAutoScored: aiAutoScore,
      },
    })

    let successfulRows = 0
    let failedRows = 0
    let duplicateRows = 0
    const errors: Array<{ row: number; message: string }> = []

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx]
      try {
        const leadData: Record<string, unknown> = {
          organizationId: context.organizationId,
          source: defaultSource,
          status: 'new',
          csvUploadId: upload.id,
          rowNumber: rowIdx + 2,
        }

        for (const [colIdx, field] of Object.entries(columnMapping)) {
          const value = row[Number(colIdx)]?.trim()
          if (!value) continue
          if (field === 'estimatedValue') {
            const num = parseFloat(value.replace(/[^0-9.-]/g, ''))
            if (!isNaN(num)) leadData[field] = num
          } else {
            leadData[field] = value
          }
        }

        const email = leadData.email as string | undefined
        const phone = leadData.phone as string | undefined

        if (!email && !phone && !leadData.firstName && !leadData.lastName) {
          failedRows++
          errors.push({ row: rowIdx + 2, message: 'Row has no identifiable lead data' })
          continue
        }

        if (email || phone) {
          const existing = await db.lead.findFirst({
            where: {
              organizationId: context.organizationId,
              OR: [
                ...(email ? [{ email: email.toLowerCase() }] : []),
                ...(phone ? [{ phone: phone.replace(/\D/g, '') }] : []),
              ],
            },
          })
          if (existing) {
            duplicateRows++
            continue
          }
        }

        if (email) leadData.email = email.toLowerCase()
        if (phone) leadData.phone = phone.replace(/\D/g, '')

        await db.lead.create({ data: leadData as Parameters<typeof db.lead.create>[0]['data'] })
        successfulRows++
      } catch (rowError) {
        failedRows++
        errors.push({
          row: rowIdx + 2,
          message: rowError instanceof Error ? rowError.message : 'Unknown error',
        })
      }
    }

    const status = failedRows === rows.length ? 'failed' : 'completed'
    const updatedUpload = await db.cSVUpload.update({
      where: { id: upload.id },
      data: {
        status,
        processedRows: rows.length,
        successfulRows,
        failedRows,
        duplicateRows,
        errors: errors.length > 0 ? errors.slice(0, 100) : undefined,
        completedAt: new Date(),
      },
    })

    return NextResponse.json({
      upload: {
        id: updatedUpload.id,
        fileName: updatedUpload.fileName,
        fileSize: updatedUpload.fileSize,
        totalRows: updatedUpload.totalRows,
        successfulRows: updatedUpload.successfulRows,
        duplicateRows: updatedUpload.duplicateRows,
        failedRows: updatedUpload.failedRows,
        status: updatedUpload.status,
        aiAutoScored: updatedUpload.aiAutoScored,
      },
      message: `Imported ${successfulRows} leads from ${rows.length} rows (${duplicateRows} duplicates, ${failedRows} errors).`,
    })
    })
  } catch (error) {
    console.error('Upload POST error:', error)
    return NextResponse.json(
      { error: 'Failed to process CSV upload', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
