import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * S28 — icon-only buttons with no accessible name.
 *
 * ## Why source-scanning tests (honest limitation, stated up front)
 * This repo has **no jsdom/happy-dom and no @testing-library** (verified absent
 * in node_modules), so components cannot be rendered in a unit test. The
 * established convention here is exported pure functions plus source assertions
 * (`src/lib/seo/seo.test.ts`, `src/components/app/nav-labels.test.ts`).
 *
 * These tests prove the attributes are PRESENT IN SOURCE. They do NOT prove a
 * screen reader or axe reports zero violations at runtime — Sentinel/OpsForge
 * must run the live accessibility pass after deploy. This guard only stops the
 * specific regression from silently returning.
 *
 * ## S28 root cause
 * Repo-wide scan found **7** unnamed `size="icon"` buttons, not the 2 Sentinel
 * reported: app-shell.tsx:235 (NotificationsBell), ai-assistant-view.tsx:392
 * (`title` only), :590 (send), page.tsx:1660 (add to stage), page.tsx:2486
 * (delete item), ui/calendar.tsx:189, ui/sidebar.tsx:264.
 *
 * Note on `title`: it is a weak accessible name (not reliably exposed to screen
 * readers, invisible to touch users), so a `title`-only button still counts as
 * unnamed for the *specific* buttons we are fixing, but the repo-wide guard
 * accepts it to avoid failing unrelated vendor primitives that pair title with
 * an icon. The named-button test below asserts real `aria-label`s.
 */

const SRC = join(process.cwd(), 'src')

function walkTsx(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walkTsx(full, out)
    else if (entry.name.endsWith('.tsx')) out.push(full)
  }
  return out
}

/**
 * Find `<Button ... size="icon" ...>` opening tags with no accessible name.
 * An accessible name may come from aria-label, aria-labelledby, or visible text.
 */
function findUnnamedIconButtons(source: string): string[] {
  const offenders: string[] = []
  const tagRe = /<Button\b[^>]*>/g
  let m: RegExpExecArray | null
  while ((m = tagRe.exec(source)) !== null) {
    const tag = m[0]
    if (!tag.includes('size="icon"')) continue
    if (tag.includes('aria-label') || tag.includes('aria-labelledby')) continue

    // Multi-line tags: the regex may have stopped at the first '>' inside an
    // attribute, so look at the element's children for visible text too.
    const afterTag = source.slice(m.index + tag.length, m.index + tag.length + 300)
    const closeIdx = afterTag.indexOf('</Button>')
    const children = closeIdx === -1 ? afterTag : afterTag.slice(0, closeIdx)
    const visibleText = children
      .replace(/<[^>]*>/g, ' ')
      .replace(/\{[^}]*\}/g, ' ')
      .trim()
    if (visibleText.length > 0) continue

    offenders.push(`${tag.replace(/\s+/g, ' ').slice(0, 110)} | children=${JSON.stringify(children.replace(/\s+/g, ' ').slice(0, 60))}`)
  }
  return offenders
}

describe('S28: icon-only buttons have an accessible name', () => {
  const files = walkTsx(SRC).filter((f) => !f.includes('.test.'))

  it('NO size="icon" button in src/ lacks aria-label/aria-labelledby/visible text', () => {
    const all: string[] = []
    for (const file of files) {
      for (const tag of findUnnamedIconButtons(readFileSync(file, 'utf8'))) {
        all.push(`${relative(join(process.cwd()), file)}: ${tag}`)
      }
    }
    expect(all, 'icon-only buttons that announce nothing to screen readers').toEqual([])
  })

  it('the buttons Sentinel named are labelled specifically', () => {
    const shell = readFileSync(join(SRC, 'components/app/app-shell.tsx'), 'utf8')

    const bellIdx = shell.indexOf('function NotificationsBell')
    expect(bellIdx, 'NotificationsBell must exist').toBeGreaterThan(-1)
    const bell = shell.slice(bellIdx, bellIdx + 1400)
    expect(bell).toMatch(/aria-label="Notifications/)

    const umIdx = shell.indexOf('function UserMenu')
    expect(umIdx, 'UserMenu must exist').toBeGreaterThan(-1)
    const um = shell.slice(umIdx, umIdx + 1800)
    expect(um).toMatch(/aria-label="(Account|User)/)
  })

  it('labels every icon button the repo-wide scan originally flagged', () => {
    const targets: Array<[string, RegExp]> = [
      ['components/app/app-shell.tsx', /aria-label="Notifications/],
      ['components/app/app-shell.tsx', /aria-label="(Account|User)/],
      ['components/ai/ai-assistant-view.tsx', /aria-label="New chat/],
      ['components/ai/ai-assistant-view.tsx', /aria-label="Send/],
      ['components/ui/sidebar.tsx', /aria-label=/],
    ]
    for (const [rel, re] of targets) {
      const src = readFileSync(join(SRC, rel), 'utf8')
      expect(re.test(src), `${rel} must match ${re}`).toBe(true)
    }
  })

  it('the dashboard buttons Sentinel could not reach (auth-gated) are labelled too', () => {
    // page.tsx is the DASHBOARD (landing is /welcome) — these are behind auth,
    // which is why Sentinel listed them as "cannot verify".
    const page = readFileSync(join(SRC, 'app/page.tsx'), 'utf8')
    // Both labels are template literals (they interpolate the stage name and the
    // item title) so the regex must accept the backtick form, not just quotes.
    expect(page).toMatch(/aria-label=\{`Add deal to /)
    expect(page).toMatch(/aria-label=\{`(Delete|Remove) /)
  })
})
