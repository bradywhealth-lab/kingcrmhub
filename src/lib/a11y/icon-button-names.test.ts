import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * S28 follow-up — icon-only buttons that announce nothing to screen readers.
 *
 * ## What PR #223 already fixed (merged, live — NOT re-done here)
 * #223 labelled the two buttons Sentinel named: NotificationsBell (with a dynamic
 * `Notifications, N unread` label) and the UserMenu trigger. That work is on main.
 *
 * ## What is still missing (measured on main `7d85303` with a corrected scanner)
 * 4 icon-only buttons have no accessible name:
 *   src/app/page.tsx:1660                    stage "+" (Plus icon only)
 *   src/app/page.tsx:2486                    delete item (Trash2 icon only)
 *   src/components/ai/ai-assistant-view.tsx:392   new chat (has `title` only)
 *   src/components/ai/ai-assistant-view.tsx:590   send (Send icon only)
 * `title` is a weak accessible name: it is not reliably exposed to assistive tech
 * and is invisible to touch users, so :392 still counts.
 *
 * ## Two scanner bugs found while measuring (both now handled, both matter)
 * 1. A naive `/<Button[^>]*>/` regex stops at the FIRST `>`, but JSX attributes
 *    contain `>` inside arrow functions (`onClick={() => ...}`). The naive scan
 *    reported 1 offender and silently hid 3, because the truncated remainder was
 *    mistaken for visible text children. This file implements a brace/quote-aware
 *    tag scanner instead. `scripts/scan-icon-buttons.py` is the standalone
 *    equivalent used during investigation.
 * 2. Two false-positive classes must be excluded explicitly:
 *      - `ui/sidebar.tsx` already names its trigger with `<span class="sr-only">`
 *      - `ui/calendar.tsx` is a self-closing primitive spreading `{...props}`, so
 *        react-day-picker supplies the name at the call site
 *    Flagging either would make this guard cry wolf and get it deleted.
 *
 * ## Honest limitation
 * No jsdom/@testing-library in this repo, so this is a source scan. It proves the
 * attributes exist; it does not prove axe reports zero violations at runtime.
 */

const ROOT = process.cwd()
const SRC = join(ROOT, 'src')

function walkTsx(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walkTsx(full, out)
    else if (entry.name.endsWith('.tsx')) out.push(full)
  }
  return out
}

/** Find the true end of a JSX opening tag, skipping '>' inside strings and {}. */
function findOpenTagEnd(src: string, start: number): number {
  let depth = 0
  let quote: string | null = null
  for (let i = start; i < src.length; i++) {
    const ch = src[i]
    if (quote) {
      if (ch === '\\') { i++; continue }
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue }
    if (ch === '{') { depth++; continue }
    if (ch === '}') { depth--; continue }
    if (ch === '>' && depth === 0) return i
  }
  return -1
}

function visibleText(children: string): string {
  let txt = children.replace(/<[^>]*>/g, ' ')
  txt = txt.replace(/\{[\s\S]*?\}/g, ' ')
  return txt.split(/\s+/).filter(Boolean).join(' ')
}

function unnamedIconButtons(src: string): string[] {
  const offenders: string[] = []
  let i = 0
  while (i < src.length) {
    const start = src.indexOf('<Button', i)
    if (start === -1) break
    const next = src[start + '<Button'.length]
    if (next !== undefined && !/[\s/>]/.test(next)) { i = start + 7; continue } // <ButtonFoo
    const end = findOpenTagEnd(src, start)
    if (end === -1) break
    const tag = src.slice(start, end + 1)
    i = end + 1

    if (!tag.includes('size="icon"')) continue
    if (tag.includes('aria-label') || tag.includes('aria-labelledby')) continue
    if (tag.trimEnd().endsWith('/>') && tag.includes('{...props}')) continue // name comes from caller

    let children: string
    if (tag.trimEnd().endsWith('/>')) {
      children = ''
    } else {
      // `end` is the index OF the closing '>', so children start at end + 1.
      // Slicing from `end` leaves a stray '>' that visibleText() reports as
      // rendered text, which skips EVERY offender and makes the repo-wide
      // assertion pass vacuously. Caught by the self-check test below.
      const close = src.indexOf('</Button>', end)
      children = close === -1 ? src.slice(end + 1, end + 201) : src.slice(end + 1, close)
    }
    if (children.includes('sr-only')) continue
    if (visibleText(children)) continue

    const line = src.slice(0, start).split('\n').length
    offenders.push(`line ${line}: ${tag.replace(/\s+/g, ' ').slice(0, 100)}`)
  }
  return offenders
}

describe('S28: icon-only buttons have an accessible name', () => {
  const files = walkTsx(SRC).filter((f) => !f.includes('.test.'))

  it('NO size="icon" button in src/ lacks an accessible name', () => {
    const all: string[] = []
    for (const file of files) {
      for (const o of unnamedIconButtons(readFileSync(file, 'utf8'))) {
        all.push(`${relative(ROOT, file)} ${o}`)
      }
    }
    expect(all, 'icon-only buttons that announce nothing to screen readers').toEqual([])
  })

  it('the 4 remaining offenders are labelled specifically', () => {
    const page = readFileSync(join(SRC, 'app/page.tsx'), 'utf8')
    expect(page).toMatch(/aria-label=\{`Add lead to \$\{stage\.name\}`\}/)
    expect(page).toMatch(/aria-label=\{`(Delete|Remove) \$\{item\.title\}`\}/)

    const ai = readFileSync(join(SRC, 'components/ai/ai-assistant-view.tsx'), 'utf8')
    expect(ai).toMatch(/aria-label="New chat"/)
    expect(ai).toMatch(/aria-label="Send message"/)
  })

  it('does NOT flag the two legitimate patterns (guards against a cry-wolf rule)', () => {
    const sidebar = readFileSync(join(SRC, 'components/ui/sidebar.tsx'), 'utf8')
    expect(sidebar).toContain('sr-only')
    expect(unnamedIconButtons(sidebar), 'sr-only names the trigger').toEqual([])

    const calendar = readFileSync(join(SRC, 'components/ui/calendar.tsx'), 'utf8')
    expect(calendar).toContain('{...props}')
    expect(unnamedIconButtons(calendar), 'name is supplied by the caller').toEqual([])
  })

  it('keeps #223 work intact: the app-shell buttons stay labelled', () => {
    const shell = readFileSync(join(SRC, 'components/app/app-shell.tsx'), 'utf8')
    // #223 shipped a DYNAMIC label including the unread count — do not flatten it.
    expect(shell).toMatch(/aria-label=\{unreadCount > 0 \? `Notifications, \$\{unreadCount\} unread` : "Notifications"\}/)
    expect(shell).toMatch(/aria-label="Account menu"/)
    expect(unnamedIconButtons(shell)).toEqual([])
  })

  it('the scanner itself is not vacuous (self-check)', () => {
    // If the brace-aware scanner ever silently degrades to matching nothing, the
    // suite would go green while real offenders returned. Prove it still detects
    // a synthetic offender, and that the naive regex would have missed it.
    const synthetic =
      '<Button size="icon" onClick={() => window.dispatchEvent(new CustomEvent("x"))}>\n  <Plus className="w-3 h-3" />\n</Button>'
    expect(unnamedIconButtons(synthetic), 'must detect an offender whose attributes contain >')
      .toHaveLength(1)

    const named = '<Button size="icon" aria-label="Thing"><Plus /></Button>'
    expect(unnamedIconButtons(named)).toEqual([])

    const withText = '<Button size="icon"><Plus /> New</Button>'
    expect(unnamedIconButtons(withText), 'visible text names it').toEqual([])

    // NON-VACUOUS guard: the scanner must actually walk the real repo files and
    // be capable of reporting offenders from them. Without this, a scanner
    // regression silently turns the repo-wide assertion above into a no-op that
    // always passes — which is exactly what happened while developing this file
    // (an off-by-one in the children slice made visibleText() see a stray '>'
    // and skip every offender). This re-detects the pre-fix source captured as a
    // literal so the check stays meaningful after the labels are added.
    const prefixMain = [
      `<Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => window.dispatchEvent(new CustomEvent("open-add-lead"))}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>`,
      `<Button size="icon" variant="ghost" className="w-8 h-8" title="New chat">
              <Plus className="w-4 h-4" />
            </Button>`,
      `<Button size="icon" className={cn('w-9 h-9')} onClick={() => void sendMessage(input)}>
              <Send className="w-4 h-4" />
            </Button>`,
    ]
    for (const [i, snippet] of prefixMain.entries()) {
      expect(
        unnamedIconButtons(snippet),
        `scanner must still detect offender shape ${i + 1} (title= alone is not a name)`,
      ).toHaveLength(1)
    }
    // and the real files must be readable/walkable at all
    const walked = walkTsx(SRC).filter((f) => !f.includes('.test.'))
    expect(walked.length, 'scanner must walk the real tree').toBeGreaterThan(50)
    expect(walked.some((f) => f.endsWith('app/page.tsx')), 'page.tsx must be in scope').toBe(true)

    // The naive regex that hid 3 of 4 offenders on main:
    const naive = synthetic.match(/<Button\b[^>]*>/)?.[0] ?? ''
    expect(naive, 'naive regex truncates at the > inside the arrow function')
      .toContain('onClick={() =')
    expect(naive).not.toContain('</Button>')
  })
})
