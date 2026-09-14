import type { Metadata } from 'next'
import { CrmPricingPage } from '@/components/pricing/crm-pricing-page'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Flat pricing with no per-seat tax. Free plan included; Pro $19/mo, Studio $39/mo, Elite $69/mo. Pipeline boards, client booking, follow-up automation, and AI guidance.',
  alternates: { canonical: '/pricing' },
}

export default function Pricing() {
  return <CrmPricingPage />
}
