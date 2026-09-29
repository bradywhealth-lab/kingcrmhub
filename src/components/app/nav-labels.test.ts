import { describe, expect, it } from 'vitest'
import { APP_NAV_ITEMS } from '@/components/app/app-shell'
import { MOBILE_TABS } from '@/components/app/mobile-tab-bar'

// Brady's live-UI report (2026-09-29): "the 'work' tab is supposed to be 'tasks'".
// Verified in the SHIPPED bundle by OpsForge and in source here: app-shell.tsx:20
// shipped { id: "tasks", label: "Work" } while mobile-tab-bar.tsx:10 shipped
// { id: "tasks", label: "Tasks" } — the two nav definitions had drifted apart.
//
// Lesson applied from PR #220: assert the RUNTIME value, never a source-string
// grep. A grep can stay green while the user sees the wrong word.

describe('APP_NAV_ITEMS (desktop nav)', () => {
  const tasks = APP_NAV_ITEMS.find(item => item.id === 'tasks')

  it('labels the tasks view "Tasks", not "Work"', () => {
    expect(tasks).toBeDefined()
    expect(tasks!.label).toBe('Tasks')
  })

  it('keeps the id as "tasks" — the router contract in page.tsx depends on it', () => {
    expect(tasks!.id).toBe('tasks')
  })

  it('does not ship the word "Work" as any nav label', () => {
    expect(APP_NAV_ITEMS.map(i => i.label)).not.toContain('Work')
  })
})

describe('nav label drift guard', () => {
  it('desktop and mobile nav agree on every shared view label', () => {
    // Both lists are hand-maintained; this test is the tripwire so a future
    // "Work"/"Tasks" style divergence fails CI instead of shipping.
    for (const tab of MOBILE_TABS) {
      const desktop = APP_NAV_ITEMS.find(item => item.id === tab.id)
      if (!desktop) continue // mobile may legitimately show a subset
      expect(desktop.label, `label mismatch for view "${tab.id}"`).toBe(tab.label)
    }
  })

  it('mobile nav also says "Tasks"', () => {
    const tab = MOBILE_TABS.find(t => t.id === 'tasks')
    expect(tab).toBeDefined()
    expect(tab!.label).toBe('Tasks')
  })

  it('every mobile tab has a matching desktop nav entry', () => {
    // A mobile-only tab would silently lose its desktop counterpart.
    const desktopIds = new Set(APP_NAV_ITEMS.map(i => i.id))
    for (const tab of MOBILE_TABS) {
      expect(desktopIds.has(tab.id), `mobile tab "${tab.id}" has no desktop nav entry`).toBe(true)
    }
  })
})
