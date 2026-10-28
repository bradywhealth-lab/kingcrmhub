"use client"

/**
 * Notifications bell data layer (t_9dadc534).
 *
 * Before this module the bell was permanently inert: a hardcoded empty mock
 * array plus an empty-dep useMemo made the dropdown unconditionally assert
 * "You're all caught up." — a false all-clear on an unbuilt feature (same
 * forbidden class as the fabricated 3.2× metric). Brady's decision: wire the
 * bell to REAL data.
 *
 * The real source is the org-scoped activity log (`GET /api/activities`),
 * which is populated today by lead status changes, AI qualification, SMS,
 * bookings, sequence runs, content publishes, and inbound Twilio webhooks.
 * No new table, migration, or API route is introduced.
 *
 * Unread semantics are honest and clock-skew-free: an activity is unread iff
 * its server `createdAt` is newer than the last-seen baseline, and EVERY
 * baseline value is a SERVER timestamp — the HTTP `Date` response header or
 * the newest activity's `createdAt` — persisted per organization in
 * localStorage. The client wall clock never participates in unread
 * comparisons, so a skewed browser clock can neither fabricate unreads nor
 * hide real ones. No server read-state exists, so none is claimed.
 *
 * "You're all caught up." renders ONLY when real items exist AND none are
 * unread; loading, error, and genuinely-empty states each get their own
 * truthful copy — never an all-clear.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { buildApiPath, readApiJsonOrText } from "@/lib/api-client"

export const LAST_SEEN_STORAGE_KEY = "kch-notifications-last-seen-at"
export const NOTIFICATIONS_FETCH_LIMIT = 20
export const REFRESH_INTERVAL_MS = 60_000
/** The bell only renders inside the header's `hidden lg:flex` cluster —
 *  polling on smaller viewports would fetch data no surface can show
 *  (cubic P3). 1024px is Tailwind's `lg` breakpoint. */
export const DESKTOP_BELL_MEDIA_QUERY = "(min-width: 1024px)"

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
export function readLastSeenAt(
  storage: StorageLike | null = defaultStorage(),
  key: string = LAST_SEEN_STORAGE_KEY,
): number | null {
  try {
    const raw = storage?.getItem(key)
    if (!raw) return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  } catch {
    return null
  }
}

export function writeLastSeenAt(
  value: number,
  storage: StorageLike | null = defaultStorage(),
  key: string = LAST_SEEN_STORAGE_KEY,
): void {
  try {
    storage?.setItem(key, String(value))
  } catch {
    // Private mode / quota — the session degrades to in-memory state, which
    // is honest: we simply won't claim items were seen across reloads.
  }
}

/**
 * Multi-tenant scoping (cubic P2): the seen-baseline key is per organization,
 * so opening the bell in org A never overwrites org B's baseline. Without a
 * scope (identity not yet loaded) it falls back to the global key.
 */
export function seenStorageKey(scope: string | null | undefined): string {
  const trimmed = scope?.trim()
  return trimmed ? `${LAST_SEEN_STORAGE_KEY}:${trimmed}` : LAST_SEEN_STORAGE_KEY
}

/** Newest parseable createdAt among activities — a SERVER timestamp, and the
 *  only kind of value the seen baseline may ever hold. Null when nothing
 *  parseable exists. */
export function latestSeenAtFrom(activities: ActivityLike[]): number | null {
  let latest: number | null = null
  for (const activity of activities) {
    const parsed = Date.parse(activity.createdAt ?? "")
    if (Number.isFinite(parsed) && (latest === null || parsed > latest)) latest = parsed
  }
  return latest
}

/**
 * First-visit baseline, in priority order — all server-sourced (cubic P2,
 * clock skew): the persisted value, else the response's HTTP `Date` header,
 * else the newest activity. Client `Date.now()` is deliberately absent: a
 * fast client clock would park the baseline in the future and render a false
 * "all caught up" for genuinely new events — the exact defect this card
 * exists to kill. Null only when the org has no activities at all AND the
 * response carried no usable Date header; with zero activities there is
 * nothing to claim unread, and the caller retries on the next poll.
 */
export function resolveInitialBaseline(args: {
  stored: number | null
  serverNow: number | null
  latestActivityAt: number | null
}): number | null {
  if (args.stored !== null) return args.stored
  if (args.serverNow !== null) return args.serverNow
  return args.latestActivityAt
}

/** Monotonic floor for the seen baseline across every source of truth —
 *  persisted storage, the in-memory high-water mark, and the candidate value
 *  (cubic P3). A null participant (degraded storage on quota/private-mode
 *  failures, or state not yet initialized) must never drag the baseline
 *  backwards: each null simply abstains from the max. */
export function nextSeenFloor(stored: number | null, inMemory: number | null, seenAt: number): number {
  return Math.max(stored ?? seenAt, inMemory ?? seenAt, seenAt)
}

/**
 * Out-of-order guard (cubic P2): mount, open-refresh, poll, and visibility
 * refreshes can overlap; a slow older response must never clobber a newer
 * list. Each fetch takes a token; results are applied only while the token
 * is still the newest issued.
 */
export function createResultGate() {
  let issued = 0
  let newest = 0
  return {
    begin(): number {
      issued += 1
      newest = issued
      return issued
    },
    isCurrent(token: number): boolean {
      return token === newest
    },
  }
}

/** Deterministic relative time for the dropdown rows. `now` is the server
 *  timestamp from the last successful response when available. */
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
  | { status: "ready"; activities: ActivityLike[]; serverNow: number | null }
  | { status: "error" }

/** Server clock from the HTTP Date header, when present and parseable. */
export function parseServerDate(response: Response): number | null {
  try {
    const raw = response.headers?.get?.("date")
    if (!raw) return null
    const parsed = Date.parse(raw)
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Single fetch attempt against the real activity log. Never throws.
 *  `cache: "no-store"` matches every other polling view in this repo
 *  (tasks-view, prompts-view) — a cached response would defeat the refresh. */
export async function fetchNotifications(fetchImpl: typeof fetch = globalThis.fetch): Promise<FetchNotificationsResult> {
  try {
    const response = await fetchImpl(buildApiPath(`/api/activities?limit=${NOTIFICATIONS_FETCH_LIMIT}`), { cache: "no-store" })
    if (!response.ok) return { status: "error" }
    const serverNow = parseServerDate(response)
    const { data } = await readApiJsonOrText(response)
    const activities = parseActivitiesPayload(data)
    if (!activities) return { status: "error" }
    return { status: "ready", activities, serverNow }
  } catch {
    return { status: "error" }
  }
}

/**
 * SSR-safe media-query match with a change subscription. The initial value is
 * read lazily on the client only; the effect subscribes to the external
 * MediaQueryList (an allowed sync — no setState in the effect body).
 */
export function useMatchesMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches,
  )
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [query])
  return matches
}

/**
 * Bell state: fetch on mount (only while `enabled` — the bell's desktop
 * breakpoint matches, so mobile never polls an invisible control), poll
 * every 60s while the tab is visible, and expose `refreshAndMarkSeen` so
 * opening the dropdown clears the badge honestly — ONLY after a successful
 * refresh, and ONLY through the newest activity actually rendered (P1:
 * marking seen on a loading/failed fetch would silently suppress items the
 * user never saw, recreating a false all-clear). A failed poll never
 * clobbers previously loaded items — it only surfaces "error" before the
 * first successful load. Superseded out-of-order responses are dropped by
 * the result gate (the seen-advance itself deliberately survives
 * supersession — see `refreshAndMarkSeen`).
 *
 * `seenKey` scopes the persisted baseline per organization (P2); callers
 * should also key the mounting component by it so an identity change
 * re-initializes every piece of state from the right baseline.
 */
export function useNotifications(seenKey: string = LAST_SEEN_STORAGE_KEY, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true
  const [status, setStatus] = useState<BellStatus>("loading")
  const [activities, setActivities] = useState<ActivityLike[]>([])
  const [lastSeenAt, setLastSeenAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const baselineSetRef = useRef(false)
  const gateRef = useRef(createResultGate())
  /** In-memory high-water mark for the seen baseline (cubic P3). A ref, not
   *  state, so rapid successive advances share one fresh floor with no
   *  stale-closure window — and so the floor still holds when storage is
   *  degraded (private mode / quota) and reads come back null. */
  const lastSeenRef = useRef<number | null>(null)

  /** Advances the seen baseline monotonically (never regresses it). Only
   *  ever called with server-sourced timestamps. The floor spans BOTH the
   *  persisted value and the in-memory high-water mark: under the
   *  documented degraded-storage path storage alone cannot hold the floor,
   *  and a first open would otherwise regress the baseline below the
   *  server-now value established on mount. */
  const advanceSeen = useCallback(
    (seenAt: number) => {
      const stored = readLastSeenAt(defaultStorage(), seenKey)
      const next = nextSeenFloor(stored, lastSeenRef.current, seenAt)
      writeLastSeenAt(next, defaultStorage(), seenKey)
      lastSeenRef.current = next
      setLastSeenAt(next)
    },
    [seenKey],
  )

  /** Applies one fetch result to state. Called only from async continuations
   *  (after await), never synchronously inside an effect body. */
  const applyResult = useCallback(
    (result: FetchNotificationsResult) => {
      if (result.status === "error") {
        setStatus((prev) => (prev === "ready" ? prev : "error"))
        return
      }
      setActivities(result.activities)
      // Relative times are computed against the server clock when the
      // response carried one — the client wall clock is a display fallback
      // here and never participates in unread comparisons.
      setNow(result.serverNow ?? Date.now())
      setStatus("ready")
      if (!baselineSetRef.current) {
        const stored = readLastSeenAt(defaultStorage(), seenKey)
        const baseline = resolveInitialBaseline({
          stored,
          serverNow: result.serverNow,
          latestActivityAt: latestSeenAtFrom(result.activities),
        })
        if (baseline !== null) {
          // First visit on this browser: baseline to the server's present
          // (or newest item). Existing history was not "missed" through the
          // bell, so claiming it unread would be as fabricated as the old
          // all-clear. Only genuinely new events badge. When the baseline is
          // unresolvable (empty org, no Date header) the ref stays unset and
          // the next successful poll retries — nothing is claimed meanwhile.
          baselineSetRef.current = true
          if (stored === null) writeLastSeenAt(baseline, defaultStorage(), seenKey)
          lastSeenRef.current = baseline
          setLastSeenAt(baseline)
        }
      }
    },
    [seenKey],
  )

  /** Fetch + apply through the out-of-order gate. Kept as a standalone async
   *  helper shape (await BEFORE any state application) so both the effect and
   *  the visibility tick share one code path; the effect calls it from an
   *  async IIFE because the repo lint rule requires setState to be lexically
   *  after an await inside the effect body. */
  const fetchGated = useCallback(
    async (isCancelled: () => boolean) => {
      const gate = gateRef.current
      const token = gate.begin()
      const result = await fetchNotifications()
      if (isCancelled() || !gate.isCurrent(token)) return
      applyResult(result)
    },
    [applyResult],
  )

  /** Opening the bell: pull fresh items, and mark seen ONLY what a successful
   *  fetch actually returned. Loading/error states advance nothing. The data
   *  application stays behind the out-of-order gate, but the seen-advance
   *  itself deliberately runs BEFORE the gate check (cubic P3): the dropdown
   *  is open and the user is viewing these items, so dropping the advance
   *  because a background poll won the gate would leave items they just read
   *  badged until a second open. The advance is monotonic, so it can never
   *  un-see anything a newer response will show. */
  const refreshAndMarkSeen = useCallback(async () => {
    const gate = gateRef.current
    const token = gate.begin()
    const result = await fetchNotifications()
    if (result.status === "ready") {
      const latest = latestSeenAtFrom(result.activities)
      if (latest !== null) advanceSeen(latest)
    }
    if (!gate.isCurrent(token)) return
    applyResult(result)
  }, [applyResult, advanceSeen])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const isCancelled = () => cancelled

    // Same pattern as tasks-view.tsx: an async IIFE whose setState calls all
    // happen after an await (never synchronously in the effect body — the
    // react-hooks set-state-in-effect rule).
    ;(async () => {
      const token = gateRef.current.begin()
      const result = await fetchNotifications()
      if (cancelled || !gateRef.current.isCurrent(token)) return
      applyResult(result)
    })()

    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return
      void fetchGated(isCancelled)
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
  }, [applyResult, fetchGated, enabled])

  const notifications = useMemo(() => toNotifications(activities, lastSeenAt, now), [activities, lastSeenAt, now])
  const unreadCount = useMemo(() => notifications.filter((n) => n.unread).length, [notifications])

  return { status, notifications, unreadCount, refreshAndMarkSeen }
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
