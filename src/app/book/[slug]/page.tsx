import { notFound } from 'next/navigation'
import { getBookingOrganizationBySlug } from '@/lib/booking'
import { BookingPage } from './booking-page'

type BookingRouteProps = {
  params: Promise<{
    slug: string
  }>
}

export default async function PublicBookingRoute({ params }: BookingRouteProps) {
  const { slug } = await params
  const organization = await getBookingOrganizationBySlug(slug)

  if (!organization) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.22),_transparent_32%),linear-gradient(180deg,_#f8fafc_0%,_#fff7ed_48%,_#ffffff_100%)] px-6 py-12 text-zinc-950">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 max-w-3xl">
          <p className="text-sm uppercase tracking-[0.4em] text-amber-700">InsuraFuze</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight">{organization.name}</h1>
          <p className="mt-4 text-lg leading-8 text-zinc-600">
            Public booking for live insurance conversations. This page feeds directly into the CRM and stages the calendar handoff.
          </p>
        </div>
        <BookingPage slug={organization.slug} organizationName={organization.name} />
      </div>
    </main>
  )
}
