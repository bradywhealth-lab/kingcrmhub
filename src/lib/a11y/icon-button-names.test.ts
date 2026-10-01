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

/**
 * Rendered text only, using the SAME brace/quote-aware lexing as the tag scan.
 *
 * The previous version used `/<[^>]*>/g` — exactly the naive pattern this file
 * exists to avoid. A child attribute containing '>' (a comparison such as
 * `{count > 0}`) truncated the child element and left attribute text behind that
 * looked like a rendered label, so a genuinely unnamed button passed.
 */
function visibleText(children: string): string {
  let out = ''
  let i = 0
  while (i < children.length) {
    const ch = children[i]
    // skip JSX element tags entirely
    if (ch === '<' && /[A-Za-z/]/.test(children[i + 1] ?? '')) {
      const end = findOpenTagEnd(children, i)
      if (end === -1) break
      i = end + 1
      continue
    }
    // skip JSX expression containers, tracking nested braces
    if (ch === '{') {
      let depth = 0
      let j = i
      for (; j < children.length; j++) {
        if (children[j] === '{') depth++
        else if (children[j] === '}') { depth--; if (depth === 0) break }
      }
      i = j + 1
      continue
    }
    out += ch
    i++
  }
  return out.split(/\s+/).filter(Boolean).join(' ')
}

/** Children text for a non-self-closing tag, or '' for a self-closing one. */
function childrenOf(src: string, tag: string, tagEndIdx: number): string {
  if (tag.trimEnd().endsWith('/>')) return ''
  // `tagEndIdx` is the index OF the closing '>', so children start one later.
  // Slicing from tagEndIdx leaves a stray '>' that visibleText() reports as
  // rendered text, skipping EVERY offender and making the repo-wide assertion
  // pass vacuously. Caught by the self-check test below.
  const start = tagEndIdx + 1

  // A plain indexOf('</Button>') is NOT scoped to THIS element: a NESTED
  // <Button> between here and the first close would make that close belong to
  // the inner element, truncating the outer scan at the wrong boundary (and a
  // literal '</Button>' inside a child string or comment would do the same).
  // No nested case exists in the repo today (measured); this keeps it correct
  // when one is added. Track nested <Button opens before each candidate close.
  let searchFrom = start
  for (;;) {
    const close = src.indexOf('</Button>', searchFrom)
    if (close === -1) return src.slice(start, start + 200) // unbalanced; bounded
    const between = src.slice(start, close)
    const opens = (between.match(/<Button(?=[\s/>])/g) ?? []).length
    const closes = (between.match(/<\/Button>/g) ?? []).length
    if (opens <= closes) return between // balanced -> this close belongs to us
    searchFrom = close + '</Button>'.length // belongs to a nested element; keep looking
  }
}

/**
 * The aria-label VALUE, or null when the attribute is absent.
 *
 * An empty literal ('' / "" / ``) is NOT an accessible name. A substring check
 * for `aria-label` accepted it, so an unnamed button passed the guard — review
 * finding at confidence 10.
 */
function ariaLabelValue(tag: string): string | null {
  const dq = tag.match(/aria-label\s*=\s*"([^"]*)"/)
  if (dq) return dq[1]
  const sq = tag.match(/aria-label\s*=\s*'([^']*)'/)
  if (sq) return sq[1]
  const expr = tag.match(/aria-label\s*=\s*\{([\s\S]*?)\}/)
  if (expr) {
    const inner = expr[1].trim()
    if (inner === "''" || inner === '""' || inner === '``') return ''
    return inner // dynamic: value not statically knowable, but present
  }
  return null
}

/** True only when a NON-EMPTY accessible name is actually present. */
function hasRealName(tag: string, children: string): boolean {
  const label = ariaLabelValue(tag)
  if (label !== null && label.trim().length > 0) return true
  if (/aria-labelledby\s*=\s*["'{][^"'}]+/.test(tag)) return true
  if (children.includes('sr-only')) return true
  return visibleText(children).length > 0
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
    if (tag.trimEnd().endsWith('/>') && tag.includes('{...props}')) continue // name comes from caller
    if (hasRealName(tag, childrenOf(src, tag, end))) continue

    const children = childrenOf(src, tag, end)

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

  it('the 4 remaining offenders are labelled, and the labels are TRUTHFUL', () => {
    const page = readFileSync(join(SRC, 'app/page.tsx'), 'utf8')

    // Was `Add lead to ${stage.name}`. Review proved that a lie: the dispatch
    // carries no detail, use-workspace-overlays' leadHandler ignores detail, and
    // add-lead-dialog's only Select is `source` — the lead does NOT land in the
    // clicked column. An honest generic label beats a specific false promise.
    expect(page).toMatch(/aria-label="Add lead"/)
    expect(page, 'the stage-specific false promise must stay gone')
      .not.toContain('Add lead to ${stage.name}')

    // item.title is string|null (/api/content does `title?.trim() || null`) and
    // the row renders `item.title || 'Untitled post'`. Interpolating the raw
    // value announced "Delete null" while the user looked at "Untitled post".
    expect(page).toMatch(/aria-label=\{`Delete \$\{item\.title \|\| 'Untitled post'\}`\}/)
    expect(page, 'raw null interpolation must stay gone')
      .not.toContain('aria-label={`Delete ${item.title}`}')

    const ai = readFileSync(join(SRC, 'components/ai/ai-assistant-view.tsx'), 'utf8')
    expect(ai).toMatch(/aria-label="New chat"/)
    expect(ai).toMatch(/aria-label="Send message"/)
  })

  it('the honest Add lead label is consistent with what the button does', () => {
    // Pin the reasoning, not just the string: the button must still dispatch the
    // generic event with NO stage payload. If someone later makes the dialog
    // stage-aware, this fails and the label should be revisited.
    const page = readFileSync(join(SRC, 'app/page.tsx'), 'utf8')
    expect(page).toContain('new CustomEvent("open-add-lead")')
    expect(page, 'open-add-lead must still carry no detail payload')
      .not.toMatch(/new CustomEvent\("open-add-lead",\s*\{\s*detail/)

    const overlays = readFileSync(join(SRC, 'components/app/use-workspace-overlays.ts'), 'utf8')
    expect(overlays).toMatch(/const leadHandler = \(\) => setShowAddLeadDialog\(true\)/)
    expect(overlays, 'leadHandler must still ignore event detail').not.toContain('leadHandler = (event')

    const dialog = readFileSync(join(SRC, 'components/app/add-lead-dialog.tsx'), 'utf8')
    expect(dialog, 'the lead dialog has no stage field').not.toMatch(/name="stage"|id="stage"/)
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

    // NESTED Button: the outer scan must not be truncated by the inner close.
    const nested =
      '<Button size="icon">\n  <span>\n    <Button size="icon" aria-label="inner"><Plus /></Button>\n  </span>\n  <Trash2 />\n</Button>'
    expect(unnamedIconButtons(nested), 'outer button stays an offender; inner is named').toHaveLength(1)

    // literal </Button> inside a child STRING must not end the scan either
    const literal =
      `<Button size="icon" title={"</Button> is not a tag"}>` +
      '<Plus className="w-3 h-3" />' +
      '</Button>'
    // the literal sits inside an attribute (parsed by the tag scanner, which
    // respects quotes), so this button has title= only -> still an offender
    expect(unnamedIconButtons(literal), 'attribute strings are not markup').toHaveLength(1)

    // UNBALANCED source (no closing tag): must terminate, not loop forever
    const unbalanced = '<Button size="icon"><Plus />no close ever'
    expect(unnamedIconButtons(unbalanced).length).toBeLessThanOrEqual(1)

    // The naive regex that hid 3 of 4 offenders on main:
    const naive = synthetic.match(/<Button\b[^>]*>/)?.[0] ?? ''
    expect(naive, 'naive regex truncates at the > inside the arrow function')
      .toContain('onClick={() =')
    expect(naive).not.toContain('</Button>')
  })
})
