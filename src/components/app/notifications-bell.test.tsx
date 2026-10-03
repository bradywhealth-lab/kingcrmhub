import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  DESKTOP_BELL_MEDIA_QUERY,
  LAST_SEEN_STORAGE_KEY,
  NotificationsBody,
  createResultGate,
  formatRelativeTime,
  latestSeenAtFrom,
  nextSeenFloor,
  parseActivitiesPayload,
  parseServerDate,
  readLastSeenAt,
  resolveInitialBaseline,
  seenStorageKey,
  toNotifications,
  writeLastSeenAt,
  fetchNotifications,
  type ActivityLike,
  type BellNotification,
} from '@/components/app/notifications-bell'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * t_9dadc534 — the notifications bell was permanently inert in production:
 * `mockNotifications = []` was a hardcoded module constant, `unreadCount` had
 * an empty-dep useMemo, and the dropdown rendered an UNCONDITIONAL
 * "You're all caught up." — a false all-clear (same forbidden class as the
 * fabricated 3.2× metric). Brady's decision: wire it to real data.
 *
 * These tests pin the contract:
 *  - the stub can never come back (source-level assertions on app-shell.tsx)
 *  - the all-clear renders ONLY when real items exist and none are unread
 *  - unread is computed against a real seen-timestamp, never asserted blindly
 *  - fetch failures degrade to a truthful error state, never an all-clear
 */

const ALL_CLEAR = "You're all caught up."

/** renderToStaticMarkup escapes apostrophes to &#x27; — compare on text. */
const asText = (html: string) => html.replace(/&#x27;/g, "'").replace(/&amp;/g, '&')

function makeActivity(overrides: Partial<ActivityLike> = {}): ActivityLike {
  return {
    id: 'act1',
    type: 'status_change',
    title: 'Lead moved to qualified',
    description: null,
    createdAt: '2026-10-01T12:00:00.000Z',
    lead: null,
    ...overrides,
  }
}

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    dump: () => Object.fromEntries(map),
  }
}

const NOW = Date.parse('2026-10-01T13:00:00.000Z')

const shellSourcePath = join(process.cwd(), 'src/components/app/app-shell.tsx')
const bellModulePath = join(process.cwd(), 'src/components/app/notifications-bell.tsx')

describe('notifications: false all-clear is impossible (t_9dadc534)', () => {
  it('renders NO all-clear while loading', () => {
    const html = renderToStaticMarkup(
      <NotificationsBody status="loading" notifications={[]} unreadCount={0} />,
    )
    expect(html).not.toContain(ALL_CLEAR)
    expect(html).toContain('Loading notifications…')
  })

  it('renders NO all-clear on fetch error', () => {
    const html = asText(
      renderToStaticMarkup(<NotificationsBody status="error" notifications={[]} unreadCount={0} />),
    )
    expect(html).not.toContain(ALL_CLEAR)
    expect(html).toContain("Couldn't load notifications.")
  })

  it('renders NO all-clear when the log is genuinely empty', () => {
    const html = renderToStaticMarkup(
      <NotificationsBody status="ready" notifications={[]} unreadCount={0} />,
    )
    expect(html).not.toContain(ALL_CLEAR)
    expect(html).toContain('No notifications yet.')
  })

  it('renders NO all-clear while any item is unread', () => {
    const notifications = toNotifications([makeActivity()], NOW - 7_200_000, NOW)
    expect(notifications[0].unread).toBe(true)
    const html = asText(
      renderToStaticMarkup(
        <NotificationsBody status="ready" notifications={notifications} unreadCount={1} />,
      ),
    )
    expect(html).not.toContain(ALL_CLEAR)
    expect(html).toContain('Lead moved to qualified')
  })

  it('renders the all-clear ONLY with real items and zero unread', () => {
    const notifications = toNotifications([makeActivity()], NOW, NOW)
    expect(notifications[0].unread).toBe(false)
    const html = asText(
      renderToStaticMarkup(
        <NotificationsBody status="ready" notifications={notifications} unreadCount={0} />,
      ),
    )
    expect(html).toContain(ALL_CLEAR)
    expect(html).toContain('Lead moved to qualified')
  })
})

describe('unread semantics are computed from a real seen-timestamp', () => {
  it('marks only post-baseline activities unread', () => {
    const older = makeActivity({ id: 'a-old', createdAt: '2026-10-01T10:00:00.000Z' })
    const newer = makeActivity({ id: 'a-new', createdAt: '2026-10-01T12:30:00.000Z' })
    const seen = Date.parse('2026-10-01T12:00:00.000Z')
    const items = toNotifications([older, newer], seen, NOW)
    expect(items.map((i) => i.unread)).toEqual([false, true])
  })

  it('claims NOTHING unread when there is no baseline (null lastSeenAt)', () => {
    const items = toNotifications([makeActivity()], null, NOW)
    expect(items.every((i) => !i.unread)).toBe(true)
  })

  it('persists and reads back the seen-timestamp', () => {
    const storage = memoryStorage()
    expect(readLastSeenAt(storage)).toBeNull()
    writeLastSeenAt(1759316400000, storage)
    expect(storage.dump()[LAST_SEEN_STORAGE_KEY]).toBe('1759316400000')
    expect(readLastSeenAt(storage)).toBe(1759316400000)
  })

  it('rejects corrupt stored values instead of trusting them', () => {
    const storage = memoryStorage({ [LAST_SEEN_STORAGE_KEY]: 'not-a-number' })
    expect(readLastSeenAt(storage)).toBeNull()
    const storage2 = memoryStorage({ [LAST_SEEN_STORAGE_KEY]: '-5' })
    expect(readLastSeenAt(storage2)).toBeNull()
  })
})

describe('seen-baseline is scoped per organization (P2) and only advances on rendered data (P1)', () => {
  it('scopes the storage key by organization', () => {
    expect(seenStorageKey('org_A')).toBe(`${LAST_SEEN_STORAGE_KEY}:org_A`)
    expect(seenStorageKey('org_B')).toBe(`${LAST_SEEN_STORAGE_KEY}:org_B`)
    expect(seenStorageKey(null)).toBe(LAST_SEEN_STORAGE_KEY)
    expect(seenStorageKey('   ')).toBe(LAST_SEEN_STORAGE_KEY)
  })

  it('org A writes never touch org B baseline', () => {
    const storage = memoryStorage()
    writeLastSeenAt(1000, storage, seenStorageKey('org_A'))
    expect(readLastSeenAt(storage, seenStorageKey('org_B'))).toBeNull()
    expect(readLastSeenAt(storage, seenStorageKey('org_A'))).toBe(1000)
  })

  it('latestSeenAtFrom returns the newest parseable createdAt only', () => {
    expect(latestSeenAtFrom([])).toBeNull()
    const activities = [
      makeActivity({ id: 'a1', createdAt: '2026-10-01T10:00:00.000Z' }),
      makeActivity({ id: 'a2', createdAt: '2026-10-01T12:30:00.000Z' }),
      makeActivity({ id: 'a3', createdAt: '2026-10-01T11:00:00.000Z' }),
    ]
    expect(latestSeenAtFrom(activities)).toBe(Date.parse('2026-10-01T12:30:00.000Z'))
  })

  it('ignores unparseable timestamps when computing the seen advance', () => {
    const activities = [
      makeActivity({ id: 'a1', createdAt: 'garbage' }),
      makeActivity({ id: 'a2', createdAt: '2026-10-01T12:30:00.000Z' }),
    ]
    expect(latestSeenAtFrom(activities)).toBe(Date.parse('2026-10-01T12:30:00.000Z'))
    expect(latestSeenAtFrom([makeActivity({ createdAt: 'garbage' })])).toBeNull()
  })

  it('the shipped open-handler never marks seen on a bare clock time', () => {
    // P1 regression pin: marking seen with Date.now() while a fetch is still
    // loading or has failed would suppress genuinely unread items. The bell
    // must advance the baseline only through refreshAndMarkSeen (success +
    // rendered items), never through a standalone timestamp write.
    const shell = readFileSync(shellSourcePath, 'utf8')
    expect(shell).toContain('void refreshAndMarkSeen()')
    expect(shell).not.toMatch(/markSeen\(Date\.now\(\)\)/)
    expect(shell).not.toMatch(/advanceSeen\(/) // app-shell never advances directly
    const bell = readFileSync(bellModulePath, 'utf8')
    // The REAL advance path: advanceSeen(latest) must sit INSIDE the
    // result.status === "ready" branch of refreshAndMarkSeen (cubic P2 —
    // asserting on a nonexistent markSeen API would be vacuous). Slice the
    // function body and check containment, not just file-wide presence.
    const fnStart = bell.indexOf('const refreshAndMarkSeen = useCallback(async () => {')
    expect(fnStart).toBeGreaterThan(-1)
    const fnBody = bell.slice(fnStart, bell.indexOf('}, [applyResult, advanceSeen])', fnStart))
    const readyIdx = fnBody.indexOf('if (result.status === "ready")')
    const advanceIdx = fnBody.indexOf('advanceSeen(latest)')
    expect(readyIdx).toBeGreaterThan(-1)
    expect(advanceIdx).toBeGreaterThan(-1)
    expect(advanceIdx).toBeGreaterThan(readyIdx) // gated by success
    expect(fnBody).not.toMatch(/advanceSeen\(Date\.now\(\)\)/)
  })
})

describe('seen baselines are server-sourced only — no client clock skew (cubic P2)', () => {
  const SERVER_NOW = Date.parse('2026-10-01T13:00:00.000Z')
  const LATEST = Date.parse('2026-10-01T12:30:00.000Z')

  it('resolveInitialBaseline prefers stored, then server Date header, then newest activity', () => {
    expect(resolveInitialBaseline({ stored: 5000, serverNow: SERVER_NOW, latestActivityAt: LATEST })).toBe(5000)
    expect(resolveInitialBaseline({ stored: null, serverNow: SERVER_NOW, latestActivityAt: LATEST })).toBe(SERVER_NOW)
    expect(resolveInitialBaseline({ stored: null, serverNow: null, latestActivityAt: LATEST })).toBe(LATEST)
    expect(resolveInitialBaseline({ stored: null, serverNow: null, latestActivityAt: null })).toBeNull()
  })

  it('parseServerDate reads the HTTP Date header and rejects garbage', () => {
    const withDate = { headers: { get: (k: string) => (k === 'date' ? 'Thu, 01 Oct 2026 13:00:00 GMT' : null) } } as unknown as Response
    expect(parseServerDate(withDate)).toBe(SERVER_NOW)
    const noDate = { headers: { get: () => null } } as unknown as Response
    expect(parseServerDate(noDate)).toBeNull()
    const garbage = { headers: { get: () => 'not-a-date' } } as unknown as Response
    expect(parseServerDate(garbage)).toBeNull()
  })

  it('fetchNotifications surfaces the server clock with ready results', async () => {
    const response = {
      ok: true,
      status: 200,
      headers: {
        get: (key: string) =>
          key === 'content-type' ? 'application/json' : key === 'date' ? 'Thu, 01 Oct 2026 13:00:00 GMT' : null,
      },
      json: async () => ({ activities: [makeActivity()] }),
      text: async () => '',
    } as unknown as Response
    const fetchImpl = vi.fn(async () => response)
    const result = await fetchNotifications(fetchImpl as unknown as typeof fetch)
    expect(result.status).toBe('ready')
    if (result.status === 'ready') expect(result.serverNow).toBe(SERVER_NOW)
  })

  it('the bell module never seeds the baseline or the seen-advance from Date.now()', () => {
    // Clock-skew pin: the ONLY legitimate Date.now() in the module is the
    // display-time fallback (`result.serverNow ?? Date.now()`) for relative
    // labels — never in resolveInitialBaseline, advanceSeen, or refreshAndMarkSeen.
    const bell = readFileSync(bellModulePath, 'utf8')
    const resolveFn = bell.slice(bell.indexOf('export function resolveInitialBaseline'), bell.indexOf('export function createResultGate'))
    expect(resolveFn).not.toContain('Date.now()')
    const advanceStart = bell.indexOf('const advanceSeen = useCallback')
    const advanceBody = bell.slice(advanceStart, bell.indexOf('[seenKey],', advanceStart))
    expect(advanceBody).not.toContain('Date.now()')
  })

  it('the seen floor spans storage AND the in-memory high-water mark (cubic P3)', () => {
    // Degraded-storage regression: `advanceSeen` must never regress the
    // baseline below the in-memory mark just because storage reads null
    // (quota / private mode). Each null participant abstains.
    expect(nextSeenFloor(null, null, 500)).toBe(500)
    expect(nextSeenFloor(500, null, 300)).toBe(500) // stored holds the floor
    expect(nextSeenFloor(null, 500, 300)).toBe(500) // in-memory holds the floor
    expect(nextSeenFloor(300, 400, 500)).toBe(500) // the candidate itself
    expect(nextSeenFloor(900, 800, 700)).toBe(900) // never regresses
  })

  it('advanceSeen floors on lastSeenRef — degraded storage cannot regress the baseline', () => {
    // Source pin: the shipped advance path must consult BOTH floors. If the
    // in-memory participant disappears from the max, the P3 regression the
    // reviewer flagged returns (first open drops the baseline from the
    // server-now value S back to `latest < S`, re-marking viewed items
    // unread for the rest of the session).
    const bell = readFileSync(bellModulePath, 'utf8')
    const advanceStart = bell.indexOf('const advanceSeen = useCallback')
    expect(advanceStart).toBeGreaterThan(-1)
    const advanceBody = bell.slice(advanceStart, bell.indexOf('[seenKey],', advanceStart))
    expect(advanceBody).toContain('nextSeenFloor(')
    expect(advanceBody).toContain('lastSeenRef.current')
  })

  it('refreshAndMarkSeen advances seen BEFORE the gate check — the advance survives supersession (cubic P3)', () => {
    // Supersession regression: the open-refresh's seen-advance used to sit
    // after `if (!gate.isCurrent(token)) return`, so a poll/visibility tick
    // issuing a newer token while the open-refresh was in flight dropped the
    // advance entirely — items the user was viewing stayed badged until a
    // second open. The advance is monotonic and runs first; only the DATA
    // application stays gated.
    const bell = readFileSync(bellModulePath, 'utf8')
    const fnStart = bell.indexOf('const refreshAndMarkSeen = useCallback(async () => {')
    expect(fnStart).toBeGreaterThan(-1)
    const fnBody = bell.slice(fnStart, bell.indexOf('}, [applyResult, advanceSeen])', fnStart))
    const advanceIdx = fnBody.indexOf('advanceSeen(latest)')
    const gateIdx = fnBody.indexOf('if (!gate.isCurrent(token)) return')
    expect(advanceIdx).toBeGreaterThan(-1)
    expect(gateIdx).toBeGreaterThan(-1)
    expect(advanceIdx).toBeLessThan(gateIdx)
    // And the advance is still success-gated inside the ready branch.
    const readyIdx = fnBody.indexOf('if (result.status === "ready")')
    expect(readyIdx).toBeGreaterThan(-1)
    expect(advanceIdx).toBeGreaterThan(readyIdx)
  })
})

describe('out-of-order responses cannot clobber newer data (cubic P2)', () => {
  it('the gate invalidates superseded tokens', () => {
    const gate = createResultGate()
    const t1 = gate.begin()
    expect(gate.isCurrent(t1)).toBe(true)
    const t2 = gate.begin() // a newer request supersedes t1
    expect(gate.isCurrent(t1)).toBe(false)
    expect(gate.isCurrent(t2)).toBe(true)
    const t3 = gate.begin()
    expect(gate.isCurrent(t2)).toBe(false)
    expect(gate.isCurrent(t3)).toBe(true)
  })

  it('all fetch paths (mount, poll, open-refresh) take a gate token and drop stale results', () => {
    const bell = readFileSync(bellModulePath, 'utf8')
    // Mount IIFE, fetchGated (poll/visibility), and refreshAndMarkSeen must
    // each begin() a token and check isCurrent(token) BEFORE applying results.
    expect(bell.match(/\.begin\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
    expect(bell.match(/isCurrent\(token\)/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
    const gatedStart = bell.indexOf('const fetchGated = useCallback')
    const gatedBody = bell.slice(gatedStart, bell.indexOf('[applyResult],', gatedStart))
    expect(gatedBody.indexOf('isCurrent')).toBeLessThan(gatedBody.indexOf('applyResult(result)'))
    const refreshStart = bell.indexOf('const refreshAndMarkSeen = useCallback(async () => {')
    const refreshBody = bell.slice(refreshStart, bell.indexOf('}, [applyResult, advanceSeen])', refreshStart))
    expect(refreshBody.indexOf('isCurrent')).toBeLessThan(refreshBody.indexOf('applyResult(result)'))
  })
})

describe('polling matches the repo conventions and the bell viewport (cubic P3)', () => {
  it('fetches with cache: "no-store" like every other polling view', async () => {
    const response = {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ activities: [] }),
      text: async () => '',
    } as unknown as Response
    const fetchImpl = vi.fn(async () => response)
    await fetchNotifications(fetchImpl as unknown as typeof fetch)
    const init = (fetchImpl.mock.calls[0] as unknown[])[1] as RequestInit
    expect(init.cache).toBe('no-store')
  })

  it('the desktop gate matches the header lg:flex breakpoint', () => {
    // Tailwind `lg` = 64rem = 1024px; the bell lives in `hidden ... lg:flex`.
    expect(DESKTOP_BELL_MEDIA_QUERY).toBe('(min-width: 1024px)')
    const shell = readFileSync(shellSourcePath, 'utf8')
    expect(shell).toContain('useMatchesMediaQuery(DESKTOP_BELL_MEDIA_QUERY)')
    expect(shell).toContain('{ enabled: isDesktop }')
  })

  it('an org change remounts the bell closed — open state lives inside it', () => {
    // cubic P2: if AppShell owned `open`, an identity-change remount could
    // leave the dropdown open on the new org without a seen refresh. The bell
    // must own its open state and be keyed by organizationId.
    const shell = readFileSync(shellSourcePath, 'utf8')
    expect(shell).toContain('key={currentUser?.organizationId ?? "no-org"}')
    expect(shell).not.toContain('notificationsOpen')
    const bellStart = shell.indexOf('function NotificationsBell')
    const bellBody = shell.slice(bellStart, shell.indexOf('function UserMenu', bellStart))
    expect(bellBody).toContain('const [open, setOpen] = useState(false)')
  })
})

describe('item mapping keeps the id/title/body/time/unread contract', () => {
  it('prefers the lead identity for the body, falls back to description', () => {
    const withLead = makeActivity({
      lead: { firstName: 'Ada', lastName: 'Lovelace', company: 'Analytical Engines' },
    })
    const [item] = toNotifications([withLead], null, NOW)
    expect(item.body).toBe('Ada Lovelace · Analytical Engines')

    const withDescription = makeActivity({ description: 'SMS delivered', lead: null })
    const [item2] = toNotifications([withDescription], null, NOW)
    expect(item2.body).toBe('SMS delivered')

    const bare = makeActivity({ description: null, lead: null })
    const [item3] = toNotifications([bare], null, NOW)
    expect(item3.body).toBe('')
    expect(item3.title).toBe('Lead moved to qualified')
  })

  it('titles fall back to a neutral label, never a fabricated one', () => {
    const [item] = toNotifications([makeActivity({ title: '   ' })], null, NOW)
    expect(item.title).toBe('Activity update')
  })

  it('formats relative times and survives invalid timestamps', () => {
    const t0 = NOW
    expect(formatRelativeTime(t0 - 30_000, t0)).toBe('just now')
    expect(formatRelativeTime(t0 - 5 * 60_000, t0)).toBe('5m ago')
    expect(formatRelativeTime(t0 - 3 * 3_600_000, t0)).toBe('3h ago')
    expect(formatRelativeTime(t0 - 2 * 86_400_000, t0)).toBe('2d ago')
    // Beyond 7 days the label is a LOCAL month/day — derive the expected
    // value in the host timezone instead of hardcoding a UTC assumption
    // (cubic P3: in UTC+14 the fixture formats a day later).
    const weekAgo = t0 - 8 * 86_400_000
    expect(formatRelativeTime(weekAgo, t0)).toBe(
      new Date(weekAgo).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    )
    expect(formatRelativeTime(Number.NaN, t0)).toBe('recently')

    const [bad] = toNotifications([makeActivity({ createdAt: 'garbage' })], NOW, NOW)
    expect(bad.time).toBe('recently')
    expect(bad.unread).toBe(false) // unparseable time ⇒ no unread claim
  })
})

describe('payload validation fails closed', () => {
  it('accepts only the { activities: [...] } envelope with string ids', () => {
    expect(parseActivitiesPayload({ activities: [makeActivity()] })).toHaveLength(1)
    expect(parseActivitiesPayload({ activities: 'nope' })).toBeNull()
    expect(parseActivitiesPayload({ activities: [{ title: 'no id' }] })).toEqual([])
    expect(parseActivitiesPayload(null)).toBeNull()
    expect(parseActivitiesPayload('text body')).toBeNull()
    expect(parseActivitiesPayload([])).toBeNull()
  })
})

describe('fetchNotifications hits the real activity log and never throws', () => {
  function jsonResponse(body: unknown, ok = true, status = 200) {
    return {
      ok,
      status,
      headers: { get: () => 'application/json' },
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response
  }

  it('GETs /api/activities and returns the rows on success', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ activities: [makeActivity()], total: 1, hasMore: false }))
    const result = await fetchNotifications(fetchImpl as unknown as typeof fetch)
    expect(result.status).toBe('ready')
    if (result.status === 'ready') expect(result.activities).toHaveLength(1)
    const url = String((fetchImpl.mock.calls[0] as unknown[])[0])
    expect(url).toContain('/api/activities?limit=20')
  })

  it('maps non-2xx (e.g. 401/500) to error, not to an empty all-clear', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: 'nope' }, false, 500))
    const result = await fetchNotifications(fetchImpl as unknown as typeof fetch)
    expect(result).toEqual({ status: 'error' })
  })

  it('maps network rejection and malformed JSON shapes to error', async () => {
    const rejecting = vi.fn(async () => {
      throw new Error('network down')
    })
    expect(await fetchNotifications(rejecting as unknown as typeof fetch)).toEqual({ status: 'error' })

    const wrongShape = vi.fn(async () => jsonResponse({ items: [] }))
    expect(await fetchNotifications(wrongShape as unknown as typeof fetch)).toEqual({ status: 'error' })
  })
})

describe('the inert stub can never be reintroduced silently (source-level)', () => {
  const shell = readFileSync(shellSourcePath, 'utf8')
  const bellModule = readFileSync(bellModulePath, 'utf8')

  it('app-shell no longer contains mockNotifications or the empty-dep useMemo', () => {
    expect(shell).not.toContain('mockNotifications')
    expect(shell).not.toMatch(/useMemo\(\(\)\s*=>\s*mockNotifications[^)]*\[\]\s*\)/)
  })

  it('the dropdown body is data-driven, not an unconditional static all-clear', () => {
    // The pre-fix source rendered the all-clear as raw JSX text with no
    // condition. Now the body must come from NotificationsBody.
    expect(shell).toContain('<NotificationsBody status={status} notifications={notifications} unreadCount={unreadCount} />')
    expect(shell).not.toContain(`<div className="px-3 py-6 text-center text-sm text-muted-foreground">${ALL_CLEAR}</div>`)
    // And inside the module, the all-clear is gated on having items.
    expect(bellModule).toMatch(/notifications\.length === 0/)
  })

  it('the bell consumes the real activities endpoint', () => {
    expect(bellModule).toContain('/api/activities?limit=')
  })

  it('keeps the #223 dynamic aria-label pinned by icon-button-names.test.ts', () => {
    expect(shell).toMatch(/aria-label=\{unreadCount > 0 \? `Notifications, \$\{unreadCount\} unread` : "Notifications"\}/)
  })
})

describe('badge and dot are live branches driven by unread state', () => {
  // These render checks use the same body component the shipped dropdown uses;
  // the trigger badge/dot branches live in app-shell and are asserted at the
  // source level (unreadCount now comes from real fetched data, not a constant).
  it('unread items carry the unread flag used by the dot/badge branches', () => {
    // seen = NOW-60m ⇒ a1 (NOW-30m) unread, a2 (NOW-90m) already read.
    const seen = NOW - 3_600_000
    const items: BellNotification[] = toNotifications(
      [
        makeActivity({ id: 'a1', createdAt: '2026-10-01T12:30:00.000Z' }),
        makeActivity({ id: 'a2', createdAt: '2026-10-01T11:30:00.000Z' }),
      ],
      seen,
      NOW,
    )
    expect(items.map((i) => i.unread)).toEqual([true, false])
    const unreadCount = items.filter((i) => i.unread).length
    expect(unreadCount).toBe(1)
    const html = renderToStaticMarkup(
      <NotificationsBody status="ready" notifications={items} unreadCount={unreadCount} />,
    )
    expect(html).toContain('bg-[var(--accent-solid)]') // unread dot rendered
    expect(asText(html)).not.toContain(ALL_CLEAR)
  })
})
