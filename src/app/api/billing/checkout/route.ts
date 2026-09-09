import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { buildNextAuthOptions } from '@/lib/next-auth'

const PAID_PLAN_IDS = new Set(['starter', 'pro', 'enterprise'])
const BILLING_OFFLINE_MESSAGE =
  'Paid upgrades are not active yet. Your account has not been charged, and we will publish billing terms before checkout opens.'

export async function POST(request: Request) {
  const session = await getServerSession(buildNextAuthOptions())
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let planId: string | undefined
  let interval: 'monthly' | 'yearly' | undefined
  try {
    const body = (await request.json()) as { planId?: unknown; interval?: unknown }
    if (typeof body.planId === 'string') planId = body.planId
    if (body.interval === 'monthly' || body.interval === 'yearly') interval = body.interval
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!planId || !interval) {
    return NextResponse.json({ error: 'planId and interval are required' }, { status: 400 })
  }
  if (!PAID_PLAN_IDS.has(planId)) {
    return NextResponse.json({ error: 'Invalid paid plan' }, { status: 400 })
  }

  return NextResponse.json({
    status: 'coming_soon',
    url: null,
    message: BILLING_OFFLINE_MESSAGE,
    planId,
    interval,
  })
}
