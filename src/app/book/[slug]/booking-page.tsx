'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'

type BookingPageProps = {
  slug: string
  organizationName: string
}

type AvailabilityResponse = {
  availability: Array<{ start: string; end: string }>
  calendarSync?: {
    status: 'configured' | 'not_configured'
    message: string
  }
  error?: string
}

type BookingResponse = {
  activityId: string
  message: string
  error?: string
}

function formatSlotLabel(start: string, end: string) {
  const startDate = new Date(start)
  const endDate = new Date(end)

  return `${new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(startDate)} - ${new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(endDate)}`
}

export function BookingPage({ slug, organizationName }: BookingPageProps) {
  const [availability, setAvailability] = useState<Array<{ start: string; end: string }>>([])
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null)
  const [statusMessage, setStatusMessage] = useState('Loading availability...')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState<BookingResponse | null>(null)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    title: 'Insurance strategy session',
    description: '',
  })

  const range = useMemo(() => {
    const from = new Date()
    from.setUTCMinutes(0, 0, 0)
    const to = new Date(from)
    to.setUTCDate(to.getUTCDate() + 10)
    return { from: from.toISOString(), to: to.toISOString() }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadAvailability() {
      setLoading(true)
      const params = new URLSearchParams({
        slug,
        from: range.from,
        to: range.to,
        duration: '30',
      })

      const response = await fetch(`/api/calendar/availability?${params.toString()}`, {
        cache: 'no-store',
      })
      const data = (await response.json()) as AvailabilityResponse

      if (cancelled) return

      if (!response.ok) {
        setAvailability([])
        setStatusMessage(data.error || 'Unable to load availability.')
      } else {
        setAvailability(data.availability || [])
        setStatusMessage(
          data.calendarSync?.message ||
            'Choose any open slot. Google Calendar sync is prepared and currently running in stub mode.'
        )
      }

      setLoading(false)
    }

    void loadAvailability()
    return () => {
      cancelled = true
    }
  }, [range.from, range.to, slug])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedSlot) {
      setStatusMessage('Select a time before confirming the booking.')
      return
    }

    setSubmitting(true)
    setStatusMessage('Creating booking...')

    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slug,
        ...form,
        start: selectedSlot.start,
        end: selectedSlot.end,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    })

    const data = (await response.json()) as BookingResponse
    if (!response.ok) {
      setStatusMessage(data.error || 'Unable to create booking.')
      setSubmitting(false)
      return
    }

    setConfirmation(data)
    setStatusMessage(data.message)
    setSubmitting(false)
  }

  if (confirmation && selectedSlot) {
    return (
      <section className="rounded-[28px] border border-emerald-200 bg-white/95 p-8 shadow-[0_32px_120px_-48px_rgba(22,101,52,0.7)]">
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-700">Confirmed</p>
        <h2 className="mt-3 text-3xl font-semibold text-zinc-950">Meeting booked</h2>
        <p className="mt-4 text-zinc-600">
          {formatSlotLabel(selectedSlot.start, selectedSlot.end)} with {organizationName}.
        </p>
        <p className="mt-3 text-sm text-zinc-500">{confirmation.message}</p>
      </section>
    )
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-[32px] border border-white/60 bg-white/92 p-8 shadow-[0_40px_140px_-52px_rgba(15,23,42,0.55)] backdrop-blur">
        <p className="text-sm uppercase tracking-[0.35em] text-amber-700">Appointment Setting</p>
        <h2 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">
          Reserve your insurance strategy session
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
          Pick a clean 30-minute slot and the CRM will create the lead, log the meeting, and prepare calendar sync.
        </p>
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900">
          {statusMessage}
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-8 text-sm text-zinc-500">
              Fetching availability...
            </div>
          ) : null}
          {!loading && availability.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-8 text-sm text-zinc-500">
              No slots are open in the selected window.
            </div>
          ) : null}
          {availability.map((slot) => {
            const selected =
              selectedSlot?.start === slot.start && selectedSlot?.end === slot.end

            return (
              <button
                key={slot.start}
                type="button"
                onClick={() => setSelectedSlot(slot)}
                className={`rounded-2xl border px-4 py-4 text-left transition ${
                  selected
                    ? 'border-zinc-950 bg-zinc-950 text-white shadow-[0_18px_50px_-24px_rgba(15,23,42,0.9)]'
                    : 'border-zinc-200 bg-white text-zinc-800 hover:border-amber-400 hover:bg-amber-50'
                }`}
              >
                <div className="text-sm font-medium">{formatSlotLabel(slot.start, slot.end)}</div>
              </button>
            )
          })}
        </div>
      </section>

      <section className="rounded-[32px] border border-zinc-200 bg-zinc-950 p-8 text-white shadow-[0_40px_140px_-52px_rgba(15,23,42,0.8)]">
        <h3 className="text-2xl font-semibold">Your details</h3>
        <p className="mt-3 text-sm leading-6 text-zinc-300">
          {selectedSlot
            ? `Selected: ${formatSlotLabel(selectedSlot.start, selectedSlot.end)}`
            : 'Choose a time, then confirm your booking.'}
        </p>

        <form className="mt-8 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              required
              value={form.firstName}
              onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
              placeholder="First name"
              className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none placeholder:text-zinc-500 focus:border-amber-400"
            />
            <input
              value={form.lastName}
              onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
              placeholder="Last name"
              className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none placeholder:text-zinc-500 focus:border-amber-400"
            />
          </div>
          <input
            required
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="Email"
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none placeholder:text-zinc-500 focus:border-amber-400"
          />
          <input
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            placeholder="Phone"
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none placeholder:text-zinc-500 focus:border-amber-400"
          />
          <input
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="Meeting title"
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none placeholder:text-zinc-500 focus:border-amber-400"
          />
          <textarea
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="What should we prepare for the call?"
            rows={5}
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none placeholder:text-zinc-500 focus:border-amber-400"
          />
          <button
            type="submit"
            disabled={!selectedSlot || submitting}
            className="w-full rounded-2xl bg-amber-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {submitting ? 'Booking...' : 'Confirm booking'}
          </button>
        </form>
      </section>
    </div>
  )
}
