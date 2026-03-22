import { db, withOrgRlsTransaction } from '@/lib/db'

type JsonRecord = Record<string, unknown>

type BookingOrganization = {
  id: string
  name: string
  slug: string
}

type AvailabilitySlot = {
  start: string
  end: string
}

type CalendarSyncStubResult = {
  attempted: boolean
  provider: 'google_calendar'
  status: 'configured' | 'not_configured'
  message: string
}

const DEFAULT_SLOT_MINUTES = 30
const WORKDAY_START_HOUR_UTC = 14
const WORKDAY_END_HOUR_UTC = 21

function isObjectRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseDateParam(value: string | null, fallback: Date): Date {
  if (!value) return fallback
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

function normalizeWindow(from: Date, to: Date): { from: Date; to: Date } {
  const normalizedFrom = new Date(from)
  const normalizedTo = new Date(to)

  if (normalizedTo <= normalizedFrom) {
    normalizedTo.setUTCDate(normalizedFrom.getUTCDate() + 7)
  }

  const maxTo = new Date(normalizedFrom)
  maxTo.setUTCDate(maxTo.getUTCDate() + 14)

  return {
    from: normalizedFrom,
    to: normalizedTo > maxTo ? maxTo : normalizedTo,
  }
}

function getBusyIntervals(activities: Array<{ metadata: unknown }>) {
  return activities
    .map((activity) => {
      if (!isObjectRecord(activity.metadata)) return null

      const startRaw = activity.metadata.start
      const endRaw = activity.metadata.end
      if (typeof startRaw !== 'string' || typeof endRaw !== 'string') return null

      const start = new Date(startRaw)
      const end = new Date(endRaw)
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null

      return { start, end }
    })
    .filter((interval): interval is { start: Date; end: Date } => interval !== null)
}

function overlapsBusySlot(start: Date, end: Date, busyIntervals: Array<{ start: Date; end: Date }>) {
  return busyIntervals.some((interval) => start < interval.end && end > interval.start)
}

export async function getBookingOrganizationBySlug(slug: string): Promise<BookingOrganization | null> {
  return db.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  })
}

export async function getCalendarAvailabilityForOrganization(
  organizationId: string,
  fromInput?: string | null,
  toInput?: string | null,
  durationMinutes = DEFAULT_SLOT_MINUTES
): Promise<AvailabilitySlot[]> {
  return withOrgRlsTransaction(organizationId, async () => {
    const now = new Date()
    const defaultFrom = new Date(now)
    defaultFrom.setUTCMinutes(0, 0, 0)
    const defaultTo = new Date(defaultFrom)
    defaultTo.setUTCDate(defaultTo.getUTCDate() + 7)

    const from = parseDateParam(fromInput ?? null, defaultFrom)
    const to = parseDateParam(toInput ?? null, defaultTo)
    const { from: windowStart, to: windowEnd } = normalizeWindow(from, to)

    const busyActivities = await db.activity.findMany({
      where: {
        organizationId,
        type: 'meeting',
        createdAt: {
          lte: windowEnd,
        },
      },
      select: {
        metadata: true,
      },
    })

    const busyIntervals = getBusyIntervals(busyActivities)
    const slots: AvailabilitySlot[] = []

    const cursor = new Date(windowStart)
    cursor.setUTCHours(0, 0, 0, 0)

    while (cursor < windowEnd) {
      const dayOfWeek = cursor.getUTCDay()
      const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5

      if (isWeekday) {
        for (
          let hour = WORKDAY_START_HOUR_UTC;
          hour < WORKDAY_END_HOUR_UTC;
          hour += 1
        ) {
          for (let minute = 0; minute < 60; minute += durationMinutes) {
            const slotStart = new Date(cursor)
            slotStart.setUTCHours(hour, minute, 0, 0)

            const slotEnd = new Date(slotStart)
            slotEnd.setUTCMinutes(slotEnd.getUTCMinutes() + durationMinutes)

            if (slotStart < windowStart || slotEnd > windowEnd || slotStart <= now) continue
            if (overlapsBusySlot(slotStart, slotEnd, busyIntervals)) continue

            slots.push({
              start: slotStart.toISOString(),
              end: slotEnd.toISOString(),
            })
          }
        }
      }

      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }

    return slots.slice(0, 100)
  })
}

export async function getGoogleCalendarSyncStub(
  organizationId: string
): Promise<CalendarSyncStubResult> {
  return withOrgRlsTransaction(organizationId, async () => {
    const integration = await db.integration.findUnique({
      where: {
        organizationId_type: {
          organizationId,
          type: 'google_calendar',
        },
      },
      select: {
        isActive: true,
      },
    })

    if (!integration?.isActive) {
      return {
        attempted: false,
        provider: 'google_calendar',
        status: 'not_configured',
        message: 'Google Calendar OAuth is not configured yet. Availability is served from the CRM stub schedule.',
      }
    }

    return {
      attempted: true,
      provider: 'google_calendar',
      status: 'configured',
      message: 'Google Calendar is connected. Event sync is prepared but still running in stub mode.',
    }
  })
}
