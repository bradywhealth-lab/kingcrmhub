import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { buildNextAuthOptions } from '@/lib/next-auth'

const PRICE_IDS: Record<string, Record<string, string>> = {
  starter: {
    monthly: 'price_crm_starter_monthly_PLACEHOLDER',
    yearly: 'price_crm_starter_yearly_PLACEHOLDER',
  },
  pro: {
    monthly: 'price_crm_pro_monthly_PLACEHOLDER',
    yearly: 'price_crm_pro_yearly_PLACEHOLDER',
  },
  enterprise: {
    monthly: 'price_crm_enterprise_monthly_PLACEHOLDER',
    yearly: 'price_crm_enterprise_yearly_PLACEHOLDER',
  },
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(buildNextAuthOptions())
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { planId, interval } = (await request.json()) as { planId: string; interval: 'monthly' | 'yearly' }

    if (!planId || !interval) {
      return NextResponse.json({ error: 'planId and interval are required' }, { status: 400 })
    }

    const priceId = PRICE_IDS[planId]?.[interval]
    if (!priceId) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    // TODO: Wire Stripe when ready:
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })
    // const checkoutSession = await stripe.checkout.sessions.create({
    //   customer_email: session.user.email!,
    //   line_items: [{ price: priceId, quantity: 1 }],
    //   mode: 'subscription',
    //   success_url: process.env.NEXTAUTH_URL + '/settings?upgraded=1',
    //   cancel_url: process.env.NEXTAUTH_URL + '/pricing',
    //   metadata: { userId: session.user.id },
    // })
    // return NextResponse.json({ url: checkoutSession.url })

    return NextResponse.json({
      url: null,
      message: 'Payments are launching very soon. You will be notified by email when billing goes live.',
      planId,
      interval,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
