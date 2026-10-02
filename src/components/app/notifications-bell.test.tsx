import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  LAST_SEEN_STORAGE_KEY,
  NotificationsBody,
  formatRelativeTime,
  latestSeenAtFrom,
  parseActivitiesPayload,
  readLastSeenAt,
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
    const bell = readFileSync(bellModulePath, 'utf8')
    expect(bell).toMatch(/if \(result\.status === "ready"\)/)
    expect(bell).toContain('latestSeenAtFrom(result.activities)')
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
    expect(formatRelativeTime(t0 - 8 * 86_400_000, t0)).toBe('Sep 23')
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
