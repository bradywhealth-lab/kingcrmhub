import { NextRequest, NextResponse } from 'next/server'
import {
  getBookingOrganizationBySlug,
  getCalendarAvailabilityForOrganization,
  getGoogleCalendarSyncStub,
} from '@/lib/booking'

export async function GET(request: NextRequest) {
  try {
    const slug = request.nextUrl.searchParams.get('slug')?.trim()
    if (!slug) {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 })
    }

    const organization = await getBookingOrganizationBySlug(slug)
    if (!organization) {
      return NextResponse.json({ error: 'Booking page not found' }, { status: 404 })
    }

    const from = request.nextUrl.searchParams.get('from')
    const to = request.nextUrl.searchParams.get('to')
    const durationParam = request.nextUrl.searchParams.get('duration')
    const durationMinutes = durationParam ? Number.parseInt(durationParam, 10) : 30

    const [availability, calendarSync] = await Promise.all([
      getCalendarAvailabilityForOrganization(
        organization.id,
        from,
        to,
        Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 30
      ),
      getGoogleCalendarSyncStub(organization.id),
    ])

    return NextResponse.json({
      organization,
      availability,
      calendarSync,
    })
  } catch (error) {
    console.error('Calendar availability error:', error)
    return NextResponse.json(
      { error: 'Failed to load availability' },
      { status: 500 }
    )
  }
}
