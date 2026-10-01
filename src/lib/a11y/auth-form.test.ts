import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * S19 follow-up — the auth page needs real <form> boundaries.
 *
 * ## What PR #223 already fixed (merged, live — NOT re-done here)
 * #223 added `id` / `name` / `autoComplete` to every auth input and bound all 9
 * Labels with `htmlFor`. That work is on main and this branch builds on it.
 *
 * ## What is still missing (verified on main `7d85303`)
 * `grep -c "<form" src/app/auth/page.tsx` → **0**. Without a form element the
 * inputs are not *associated with a submit*, which is what browsers use to decide
 * when to offer to save credentials and when to submit on Enter. OpsForge
 * confirmed this live on the deployed build: "the form wrapper is missing".
 *
 * Also on main: **3** `<button>` elements declare no `type` (lines 410, 547, 570)
 * and **4** `<Button>`s have no `type`. Inside a form, a button with no `type`
 * defaults to `type=submit` — so wrapping the inputs in a form WITHOUT fixing
 * these would make the tab switcher submit credentials. Both changes must land
 * together; that coupling is why they are one PR.
 *
 * ## Honest limitation
 * This repo has no jsdom/@testing-library (verified absent in node_modules), so
 * these are source assertions. They prove the markup is correct; they do NOT prove
 * Chrome actually offers to save a password. That needs the live browser pass.
 */

const AUTH = join(process.cwd(), 'src/app/auth/page.tsx')

/**
 * Strip JSX/JS comments before counting tags.
 *
 * Required because the implementation's explanatory comment legitimately
 * mentions `<form>` in prose, which a raw `match(/<form/g)` counts as a real
 * element. Counting comments is how a guard passes without the fix existing.
 */
function codeOnly(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')   // {/* ... */}
    .replace(/\/\*[\s\S]*?\*\//g, '')          // /* ... */
    .replace(/^\s*\/\/.*$/gm, '')                 // // ...
}

describe('S19: auth modes are wrapped in real <form> elements', () => {
  const raw = readFileSync(AUTH, 'utf8')
  const source = codeOnly(raw)

  it('has exactly one form per auth mode (login/signup, forgot, reset)', () => {
    // Mutation testing on the earlier branch found that asserting ">= 1 form"
    // let a revert of any single form pass. Assert the exact count.
    expect(source.match(/<form\b/g)?.length ?? 0, 'one <form> per mode').toBe(3)
    expect(source.match(/<\/form>/g)?.length ?? 0, 'every form closed').toBe(3)
  })

  it('every form prevents the default full-page navigation', () => {
    expect(source.match(/onSubmit=/g)?.length ?? 0).toBe(3)
    expect(source.match(/event\.preventDefault\(\)|e\.preventDefault\(\)/g)?.length ?? 0)
      .toBeGreaterThanOrEqual(3)
  })

  it('the credential inputs are INSIDE a form, not in a bare div', () => {
    // The login/signup block must open a form before the signup fields and close
    // it after the primary CTA — otherwise the inputs are still unassociated.
    const open = source.indexOf('<form')
    const firstInput = source.indexOf('id="auth-email"')
    const pwd = source.indexOf('id="auth-password"')
    expect(open).toBeGreaterThan(-1)
    expect(open, 'form must open before the email field').toBeLessThan(firstInput)
    expect(firstInput).toBeLessThan(pwd)
    // and the email/password fields must come before the first </form>
    const close = source.indexOf('</form>')
    expect(close).toBeGreaterThan(pwd)

    // Closing the form is not enough: the PRIMARY SUBMIT must be inside it, or
    // clicking the CTA does nothing. Moving `</form>` above the button leaves
    // every assertion above green — review found this hole. Prove the submit
    // button sits between the password field and the form's own close.
    const submit = source.indexOf('type="submit"', pwd)
    expect(submit, 'a submit button must exist after the password field').toBeGreaterThan(pwd)
    expect(submit, 'the submit button must be INSIDE the form, not after </form>').toBeLessThan(close)
  })

  it('each form contains exactly one submit button (3 submits, 3 forms)', () => {
    // A submit outside any form is dead; two submits in one form is ambiguous.
    const forms: string[] = []
    let i = 0
    for (;;) {
      const open = source.indexOf('<form', i)
      if (open === -1) break
      const tagEnd = source.indexOf('>', open)
      expect(tagEnd, 'the <form> tag must be closed').toBeGreaterThan(open)
      const close = source.indexOf('</form>', open)
      expect(close, 'every form must be closed').toBeGreaterThan(tagEnd)
      // body only — excludes the opening tag itself, so the nested-form
      // assertion below is actually meaningful rather than always matching
      forms.push(source.slice(tagEnd + 1, close))
      i = close + '</form>'.length
    }
    expect(forms).toHaveLength(3)
    for (const [n, form] of forms.entries()) {
      expect(form.match(/type="submit"/g)?.length ?? 0, `form ${n + 1} must have exactly one submit`).toBe(1)
      expect(form, `form ${n + 1} must not contain a stray <form`).not.toContain('<form')
    }
  })
})

describe('S19: every button declares an explicit type', () => {
  const source = codeOnly(readFileSync(AUTH, 'utf8'))

  it('no <button> is left with an implicit type', () => {
    // An implicit type inside a form is type=submit. On main, lines 410 (tab
    // switcher), 547 and 570 (back links) had no type.
    const tags = source.match(/<button\b[^>]*>/g) ?? []
    expect(tags.length, 'sanity: the page has lowercase buttons').toBeGreaterThan(0)
    for (const tag of tags) {
      expect(tag, `implicit-type button would submit the form: ${tag.slice(0, 80)}`)
        .toMatch(/type="(submit|button)"/)
    }
  })

  it('no <Button> component is left with an implicit type', () => {
    // <Button> renders a real <button>, so the same default applies.
    // NOTE: matched with a brace/quote-aware scan because `onClick={() => ...}`
    // contains a '>' that truncates a naive /<Button[^>]*>/ regex.
    const offenders: string[] = []
    let i = 0
    while (i < source.length) {
      const start = source.indexOf('<Button', i)
      if (start === -1) break
      // find the true end of the opening tag, tracking quotes and {} depth
      let depth = 0
      let quote: string | null = null
      let j = start + '<Button'.length
      let end = -1
      for (; j < source.length; j++) {
        const ch = source[j]
        if (quote) {
          if (ch === '\\') { j++; continue }
          if (ch === quote) quote = null
          continue
        }
        if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue }
        if (ch === '{') { depth++; continue }
        if (ch === '}') { depth--; continue }
        if (ch === '>' && depth === 0) { end = j; break }
      }
      if (end === -1) break
      const tag = source.slice(start, end + 1)
      if (!/type="(submit|button)"/.test(tag)) offenders.push(tag.replace(/\s+/g, ' ').slice(0, 90))
      i = end + 1
    }
    expect(offenders, '<Button> without an explicit type').toEqual([])
  })

  it('exactly one submit button per mode (3 total)', () => {
    expect(source.match(/type="submit"/g)?.length ?? 0).toBe(3)
  })

  it('the tab switcher cannot submit credentials', () => {
    const idx = source.indexOf('key={tab}')
    expect(idx, 'tab switcher must exist').toBeGreaterThan(-1)
    const tag = source.slice(source.lastIndexOf('<button', idx), source.indexOf('>', idx))
    expect(tag).toContain('type="button"')
  })

  it('the forgot-mode "Continue to reset" is a plain button', () => {
    // DO NOT anchor on `switchMode('reset')`. Its FIRST occurrence is the login
    // block's lowercase <button> "Finish resetting your password" — a different
    // element in a different form. Anchoring there made this test inspect the
    // login CTA via lastIndexOf('<Button') and pass for the wrong reason
    // (review finding, confidence 9). Anchor on text unique to the forgot mode.
    const idx = source.indexOf('Continue to reset')
    expect(idx, 'the forgot-mode CTA must exist').toBeGreaterThan(-1)
    const start = source.lastIndexOf('<Button', idx)
    expect(start, 'must find the <Button> that renders it').toBeGreaterThan(-1)
    // tag = from '<Button' up to and including its own closing '>'
    const tagEnd = source.indexOf('>', start)
    expect(tagEnd, 'the Button tag must be closed').toBeGreaterThan(start)
    const tag = source.slice(start, tagEnd)
    expect(tag, 'must not submit the forgot form').toContain('type="button"')
    expect(tag, 'must be the shadcn Button component, not a raw <button>').not.toMatch(/<button/)
    // and it must be the forgot mode's CTA specifically
    expect(source.slice(start, idx), 'must be the forgot mode CTA').toContain("switchMode('reset')")
  })

  it('the login block\'s own "Finish resetting your password" is also a plain button', () => {
    // This is the button the previous test USED to hit by accident. Assert it
    // explicitly so both mode-switching buttons are covered, not one of them.
    const idx = source.indexOf('Finish resetting your password')
    expect(idx).toBeGreaterThan(-1)
    const start = source.lastIndexOf('<button', idx)
    const tag = source.slice(start, source.indexOf('>', start))
    expect(tag, 'must not submit the login form').toContain('type="button"')
  })

  it('the forgot form cannot re-send after a request already succeeded', () => {
    // Once forgotRequested is true the visible CTA becomes "Continue to reset",
    // so pressing Enter in the email field must not fire a second request.
    expect(source).toMatch(/if \(!forgotRequested\) void handleForgotPassword\(\)/)
  })
})

describe('S19: Enter-to-submit is handled once, not twice', () => {
  const source = codeOnly(readFileSync(AUTH, 'utf8'))

  it('removes the hand-rolled onKeyDown Enter handlers (native submit covers it)', () => {
    // Main has 5 `onKeyDown` handlers. With a real form, Enter fires submit AND
    // the handler would fire handleLoginSignup a second time — a double request.
    expect(source).not.toContain("e.key === 'Enter'")
  })

  it('DOCUMENTS the consequence: native validation now pre-empts the app messages', () => {
    // Honest disclosure, asserted rather than buried in prose.
    //
    // The inputs already carried `required` (and `minLength={8}` on reset) but
    // were NOT inside a form, so native validation never fired and
    // handleLoginSignup's own setError('Email and password are required.') did
    // the work. Wrapping them in a <form> makes the browser intercept empty
    // submits FIRST, so those app-level "required" branches become unreachable
    // for the empty case.
    //
    // This is the standard, more accessible behaviour (native messages are
    // announced and the field is focused), not a regression — but it IS a
    // behaviour change and the app messages are now only reachable for cases
    // native validation cannot express, e.g. "Passwords do not match."
    const source = codeOnly(readFileSync(AUTH, 'utf8'))
    expect(source).toMatch(/id="auth-email"[^/]*required/)
    expect(source).toMatch(/id="auth-password"[^/]*required/)
    // mismatch is NOT expressible natively, so it must survive
    expect(source).toContain('Passwords do not match.')
    // native minLength now covers the reset fields
    expect(source).toMatch(/id="reset-new-password"[^/]*minLength=\{8\}/)
  })

  it('login mode offers current-password so saved credentials autofill', () => {
    // The password field is SHARED between login and signup and must switch:
    //   login  -> current-password  (password manager fills the SAVED credential)
    //   signup -> new-password      (manager GENERATES one instead)
    // If login stops offering current-password, autofill of existing accounts
    // silently breaks even though `autoComplete` is still present — mutation
    // testing found this gap: a "present but wrong value" mutant passed the
    // weaker assertion below.
    const source = codeOnly(readFileSync(AUTH, 'utf8'))
    expect(source).toMatch(
      /autoComplete=\{mode === 'login' \? 'current-password' : 'new-password'\}/,
    )
  })

  it('keeps #223 work intact: name + autoComplete on every credential input', () => {
    // Guard against this branch regressing the merged PR.
    const blocks: string[] = []
    let i = 0
    while (true) {
      const s = source.indexOf('<Input', i)
      if (s === -1) break
      const e = source.indexOf('/>', s)
      blocks.push(source.slice(s, e))
      i = e + 2
    }
    const passwords = blocks.filter((b) => b.includes('type="password"'))
    expect(passwords.length).toBeGreaterThanOrEqual(4)
    for (const p of passwords) {
      expect(p).toMatch(/\bname="/)
      expect(p).toMatch(/autoComplete=/)
      // never offer to autofill an OLD password into a reset/confirm field
      if (/autoComplete="/.test(p)) {
        expect(p).not.toContain('autoComplete="current-password"')
      }
    }
    // `.every()` on an EMPTY array returns true, so deleting all nine labels
    // would have left this #223 guard green (review finding, confidence 10).
    // Assert the exact count, then the binding in BOTH directions.
    const labels = source.match(/<Label\b[^>]*>/g) ?? []
    expect(labels.length, '#223 bound 9 labels — deleting them must fail this guard').toBe(9)
    for (const l of labels) {
      expect(l, 'every label must declare htmlFor').toMatch(/htmlFor="/)
    }

    // Every htmlFor must point at an id that actually exists, and every input id
    // must be claimed by exactly one label. One-directional checks let a renamed
    // id or an orphaned input slip through.
    const htmlForIds = labels.map((l) => l.match(/htmlFor="([^"]+)"/)?.[1])
    expect(htmlForIds.every((x) => typeof x === 'string' && x.length > 0)).toBe(true)
    expect(new Set(htmlForIds).size, 'no duplicate htmlFor targets').toBe(htmlForIds.length)

    const inputIds = [...source.matchAll(/<Input[\s\S]*?\bid="([^"]+)"/g)].map((m) => m[1])
    expect(inputIds.length, 'auth has 9 labelled inputs').toBe(9)
    expect([...inputIds].sort()).toEqual([...(htmlForIds as string[])].sort())
    for (const id of htmlForIds) {
      expect(source, `htmlFor="${id}" must match a real id`).toContain(`id="${id}"`)
    }
  })
})
