import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'

const createCommissionSchema = z.object({
  clientName: z.string().min(1).max(200),
  carrier: z.string().max(200).optional(),
  product: z.string().max(200).optional(),
  policyNumber: z.string().max(100).optional(),
  leadId: z.string().optional(),
  type: z.enum(['new_business', 'renewal', 'override', 'bonus']).optional(),
  premiumAmount: z.coerce.number().nonnegative().optional(),
  commissionRate: z.coerce.number().min(0).max(100).optional(),
  commissionAmount: z.coerce.number(),
  effectiveDate: z.string().optional(),
  paidDate: z.string().optional(),
  status: z.enum(['pending', 'paid', 'clawed_back']).optional(),
  notes: z.string().max(2000).optional(),
})

export async function GET(request: NextRequest) {
  try {
    return await withRequestOrgContext(request, async (context) => {
      const { searchParams } = new URL(request.url)
      const status = searchParams.get('status')
      const type = searchParams.get('type')
      const limit = Math.max(1, Math.min(200, Number(searchParams.get('limit') || '100')))

      const where: Record<string, unknown> = { organizationId: context.organizationId }
      if (status) where.status = status
      if (type) where.type = type

      const commissions = await db.commission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      })

      const totals = await db.commission.groupBy({
        by: ['status'],
        where: { organizationId: context.organizationId },
        _sum: { commissionAmount: true },
        _count: true,
      })

      const totalPending = totals.find((t) => t.status === 'pending')?._sum.commissionAmount || 0
      const totalPaid = totals.find((t) => t.status === 'paid')?._sum.commissionAmount || 0
      const totalClawedBack = totals.find((t) => t.status === 'clawed_back')?._sum.commissionAmount || 0

      return NextResponse.json({
        commissions,
        summary: {
          totalPending,
          totalPaid,
          totalClawedBack,
          netEarnings: totalPaid - totalClawedBack,
          count: commissions.length,
        },
      })
    })
  } catch (error) {
    console.error('Commissions GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch commissions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'commissions-create', limit: 60, windowMs: 60_000 })
    if (limited) return limited
    return await withRequestOrgContext(request, async (context) => {
      const parsed = await parseJsonBody(request, createCommissionSchema)
      if (!parsed.success) return parsed.response

      const data = parsed.data
      const commission = await db.commission.create({
        data: {
          organizationId: context.organizationId,
          clientName: data.clientName.trim(),
          carrier: data.carrier?.trim() || null,
          product: data.product?.trim() || null,
          policyNumber: data.policyNumber?.trim() || null,
          leadId: data.leadId || null,
          type: data.type || 'new_business',
          premiumAmount: data.premiumAmount || null,
          commissionRate: data.commissionRate || null,
          commissionAmount: data.commissionAmount,
          effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : null,
          paidDate: data.paidDate ? new Date(data.paidDate) : null,
          status: data.status || 'pending',
          notes: data.notes?.trim() || null,
        },
      })
      return NextResponse.json({ commission })
    })
  } catch (error) {
    console.error('Commissions POST error:', error)
    return NextResponse.json({ error: 'Failed to create commission' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'commissions-update', limit: 80, windowMs: 60_000 })
    if (limited) return limited
    return await withRequestOrgContext(request, async (context) => {
      const { searchParams } = new URL(request.url)
      const id = searchParams.get('id')
      if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

      const existing = await db.commission.findFirst({
        where: { id, organizationId: context.organizationId },
      })
      if (!existing) return NextResponse.json({ error: 'Commission not found' }, { status: 404 })

      const body = await request.json()
      const data: Record<string, unknown> = {}
      if (body.status) data.status = body.status
      if (body.paidDate) data.paidDate = new Date(body.paidDate)
      if (body.notes !== undefined) data.notes = body.notes || null
      if (body.commissionAmount !== undefined) data.commissionAmount = Number(body.commissionAmount)

      const updated = await db.commission.update({ where: { id }, data })
      return NextResponse.json({ commission: updated })
    })
  } catch (error) {
    console.error('Commissions PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update commission' }, { status: 500 })
  }
}
