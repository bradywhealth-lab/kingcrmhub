"use client"

/**
 * Notifications bell data layer (t_9dadc534).
 *
 * Before this module the bell was permanently inert: `mockNotifications = []`
 * was a hardcoded module constant and the dropdown unconditionally asserted
 * "You're all caught up." — a false all-clear on an unbuilt feature (same
 * forbidden class as the fabricated 3.2× metric). Brady's decision: wire the
 * bell to REAL data.
 *
 * The real source is the org-scoped activity log (`GET /api/activities`),
 * which is populated today by lead status changes, AI qualification, SMS,
 * bookings, sequence runs, content publishes, and inbound Twilio webhooks.
 * No new table, migration, or API route is introduced.
 *
 * Unread semantics are honest and client-side: an activity is unread iff it
 * was created after the last time this browser opened the bell
 * (`lastSeenAt`, persisted in localStorage). No server read-state exists, so
 * none is claimed. "You're all caught up." renders ONLY when real items
 * exist AND none are unread; loading, error, and genuinely-empty states each
 * get their own truthful copy — never an all-clear.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { buildApiPath, readApiJsonOrText } from "@/lib/api-client"

export const LAST_SEEN_STORAGE_KEY = "kch-n…n-at"
export const NOTIFICATIONS_FETCH_LIMIT = 20
export const REFRESH_INTERVAL_MS = 60_000

/** Subset of the Activity row returned by GET /api/activities. */
export type ActivityLike = {
  id: string
  type?: string | null
  title?: string | null
  description?: string | null
  createdAt?: string | null
  lead?: { firstName?: string | null; lastName?: string | null; company?: string | null } | null
}

/** The bell's item contract (id/title/body/time/unread), per the card. */
export type BellNotification = {
  id: string
  title: string
  body: string
  time: string
  createdAt: number
  unread: boolean
}

export type BellStatus = "loading" | "ready" | "error"

type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null
  } catch {
    return null
  }
}

/** Last time this browser saw the bell's contents, or null when unknown. */
export function readLastSeenAt(storage: StorageLike | null = defaultStorage()): number | null {
  try {
    const raw = storage?.getItem(LAST_SEEN_STORAGE_KEY)
    if (!raw) return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  } catch {
    return null
  }
}

export function writeLastSeenAt(value: number, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(LAST_SEEN_STORAGE_KEY, String(value))
  } catch {
    // Private mode / quota — the session degrades to in-memory state, which
    // is honest: we simply won't claim items were seen across reloads.
  }
}

/** Deterministic relative time for the dropdown rows. */
export function formatRelativeTime(createdAt: number, now: number): string {
  if (!Number.isFinite(createdAt) || !Number.isFinite(now)) return "recently"
  const diff = now - createdAt
  if (Number.isNaN(diff)) return "recently"
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/** Maps raw activities to bell items. Unknown baseline (null) ⇒ nothing is
 *  claimed unread — we only assert unread against a real seen-timestamp. */
export function toNotifications(activities: ActivityLike[], lastSeenAt: number | null, now: number): BellNotification[] {
  return activities.map((activity) => {
    const createdAt = Date.parse(activity.createdAt ?? "")
    const validTime = Number.isFinite(createdAt)
    const person = activity.lead
      ? [`${activity.lead.firstName ?? ""} ${activity.lead.lastName ?? ""}`.trim(), activity.lead.company].filter(Boolean).join(" · ")
      : ""
    return {
      id: activity.id,
      title: activity.title?.trim() || "Activity update",
      body: person || activity.description?.trim() || "",
      time: validTime ? formatRelativeTime(createdAt, now) : "recently",
      createdAt: validTime ? createdAt : 0,
      unread: validTime && lastSeenAt !== null && createdAt > lastSeenAt,
    }
  })
}

/** Validates the `{ activities: [...] }` envelope; null on any mismatch. */
export function parseActivitiesPayload(data: unknown): ActivityLike[] | null {
  if (!data || typeof data !== "object") return null
  const activities = (data as { activities?: unknown }).activities
  if (!Array.isArray(activities)) return null
  return activities.filter(
    (item): item is ActivityLike =>
      !!item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string",
  )
}

export type FetchNotificationsResult =
  | { status: "ready"; activities: ActivityLike[] }
  | { status: "error" }

/** Single fetch attempt against the real activity log. Never throws. */
export async function fetchNotifications(fetchImpl: typeof fetch = globalThis.fetch): Promise<FetchNotificationsResult> {
  try {
    const response = await fetchImpl(buildApiPath(`/api/activities?limit=${NOTIFICATIONS_FETCH_LIMIT}`))
    if (!response.ok) return { status: "error" }
    const { data } = await readApiJsonOrText(response)
    const activities = parseActivitiesPayload(data)
    if (!activities) return { status: "error" }
    return { status: "ready", activities }
  } catch {
    return { status: "error" }
  }
}

/**
 * Bell state: fetch on mount, poll every 60s while the tab is visible, and
 * expose markSeen so opening the dropdown clears the badge honestly (items
 * stay listed; only the unread claim clears). A failed poll never clobbers
 * previously loaded items — it only surfaces "error" before the first
 * successful load.
 */
export function useNotifications() {
  const [status, setStatus] = useState<BellStatus>("loading")
  const [activities, setActivities] = useState<ActivityLike[]>([])
  const [lastSeenAt, setLastSeenAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const baselineSetRef = useRef(false)

  /** Applies one fetch result to state. Called only from async continuations
   *  (after await), never synchronously inside an effect body. */
  const applyResult = useCallback((result: FetchNotificationsResult) => {
    if (result.status === "error") {
      setStatus((prev) => (prev === "ready" ? prev : "error"))
      return
    }
    setActivities(result.activities)
    setNow(Date.now())
    setStatus("ready")
    if (!baselineSetRef.current) {
      baselineSetRef.current = true
      setLastSeenAt((prev) => {
        if (prev !== null) return prev
        const stored = readLastSeenAt()
        if (stored !== null) return stored
        // First visit on this browser: baseline to now. Existing history was
        // not "missed" through the bell, so claiming it unread would be as
        // fabricated as the old all-clear. Only genuinely new events badge.
        const baseline = Date.now()
        writeLastSeenAt(baseline)
        return baseline
      })
    }
  }, [])

  const refresh = useCallback(async () => {
    applyResult(await fetchNotifications())
  }, [applyResult])

  const markSeen = useCallback((seenAt: number) => {
    writeLastSeenAt(seenAt)
    setLastSeenAt(seenAt)
  }, [])

  useEffect(() => {
    let cancelled = false

    // Same pattern as tasks-view.tsx: an async IIFE whose setState calls all
    // happen after an await (never synchronously in the effect body — the
    // react-hooks set-state-in-effect rule).
    ;(async () => {
      const result = await fetchNotifications()
      if (cancelled) return
      applyResult(result)
    })()

    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return
      void (async () => {
        const result = await fetchNotifications()
        if (!cancelled) applyResult(result)
      })()
    }
    const interval = setInterval(tick, REFRESH_INTERVAL_MS)
    const onVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") tick()
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange)
    }
    return () => {
      cancelled = true
      clearInterval(interval)
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange)
      }
    }
  }, [applyResult])

  const notifications = useMemo(() => toNotifications(activities, lastSeenAt, now), [activities, lastSeenAt, now])
  const unreadCount = useMemo(() => notifications.filter((n) => n.unread).length, [notifications])

  return { status, notifications, unreadCount, refresh, markSeen }
}

/**
 * Dropdown body. Every state tells the truth:
 * loading → "Loading notifications…", error → "Couldn't load notifications.",
 * real zero → "No notifications yet.", and the all-clear appears ONLY when
 * items exist and none are unread.
 */
export function NotificationsBody({
  status,
  notifications,
  unreadCount,
}: {
  status: BellStatus
  notifications: BellNotification[]
  unreadCount: number
}) {
  if (status === "loading") {
    return <div className="px-3 py-6 text-center text-sm text-muted-foreground">Loading notifications…</div>
  }
  if (status === "error") {
    return (
      <div className="px-3 py-6 text-center text-sm text-muted-foreground" role="status">
        Couldn&apos;t load notifications.
      </div>
    )
  }
  if (notifications.length === 0) {
    return <div className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications yet.</div>
  }
  return (
    <div className="max-h-80 overflow-y-auto">
      {notifications.map((notification) => (
        <div key={notification.id} className="flex gap-2.5 border-b border-border/40 px-3 py-2.5 last:border-0">
          <span
            aria-hidden
            className={cn(
              "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
              notification.unread ? "bg-[var(--accent-solid)]" : "bg-transparent",
            )}
          />
          <div className="min-w-0">
            <p className={cn("truncate text-sm", notification.unread ? "font-semibold text-foreground" : "font-medium text-muted-foreground")}>
              {notification.title}
            </p>
            {notification.body && <p className="truncate text-xs text-muted-foreground">{notification.body}</p>}
            <p className="mt-0.5 text-[11px] text-muted-foreground/70">{notification.time}</p>
          </div>
        </div>
      ))}
      {unreadCount === 0 && (
        <div className="px-3 py-3 text-center text-xs text-muted-foreground">You&apos;re all caught up.</div>
      )}
    </div>
  )
}
