import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * S19 — auth inputs had no `<form>`, `name`, or `autoComplete`, so password
 * managers could neither offer to save nor autofill credentials.
 *
 * ## Root cause (measured)
 * `grep -c "<form" src/app/auth/page.tsx` → **0**. The page renders bare
 * `<Input>` elements inside `<div>`s and hand-rolls Enter handling with
 * `onKeyDown={(e) => e.key === 'Enter' && ...}`. The `Input` primitive spreads
 * `...props` (src/components/ui/input.tsx), so it already *accepts* `name` and
 * `autoComplete` — the defect was absence, not incapability.
 *
 * ## Honest limitation
 * No jsdom/@testing-library in this repo, so these are source assertions. They
 * prove the attributes exist; they do NOT prove Chrome actually offers to save a
 * password. That needs the live browser pass (OpsForge/Sentinel, post-deploy).
 */

const AUTH = join(process.cwd(), 'src/app/auth/page.tsx')

describe('S19: auth inputs are password-manager friendly', () => {
  const source = readFileSync(AUTH, 'utf8')

  it('wraps ALL THREE auth modes in a real <form> (was 0 forms)', () => {
    // Mutation testing found this hole: asserting >=1 let a revert of any single
    // form pass. The page has three independent modes — login/signup (shared),
    // forgot, reset — and each needs its own form boundary or its inputs are not
    // associated with a submit, which is what makes password managers work.
    const forms = source.match(/<form\b/g) ?? []
    const closes = source.match(/<\/form>/g) ?? []
    expect(forms.length, 'exactly one <form> per auth mode').toBe(3)
    expect(closes.length, 'every form must be closed').toBe(3)
    expect(source.match(/onSubmit=/g)?.length, 'every form needs onSubmit').toBe(3)
    expect(source.match(/event\.preventDefault\(\)/g)?.length, 'onSubmit must not do a full navigation').toBe(3)
  })

  it('every button inside a form declares type=submit or type=button explicitly', () => {
    // A <button> with no type inside a form defaults to type=submit, which would
    // make the tab switcher and the "Continue to reset" / back links submit the
    // credentials form. Assert none are left implicit.
    const btnTags = source.match(/<button\b[^>]*>/g) ?? []
    for (const tag of btnTags) {
      expect(tag, `button must declare an explicit type: ${tag.slice(0, 90)}`).toMatch(/type="(submit|button)"/)
    }
    const btnComponents = source.match(/<Button\b[^>]*>/g) ?? []
    for (const tag of btnComponents) {
      expect(tag, `<Button> must declare an explicit type: ${tag.slice(0, 90)}`).toMatch(/type="(submit|button)"/)
    }
  })

  it('the tab switcher is type=button (must never submit credentials)', () => {
    // Mutation testing found NO assertion covered this at all.
    const idx = source.indexOf('key={tab}')
    expect(idx, 'tab switcher must exist').toBeGreaterThan(-1)
    const tag = source.slice(source.lastIndexOf('<button', idx), source.indexOf('>', idx))
    expect(tag).toContain('type="button"')
  })

  it('the forgot-mode "Continue to reset" is type=button, and its submit is gated', () => {
    const idx = source.indexOf("switchMode('reset')")
    expect(idx).toBeGreaterThan(-1)
    const tag = source.slice(source.lastIndexOf('<Button', idx), source.indexOf('>', idx))
    expect(tag, 'must not submit the forgot form').toContain('type="button"')
    // the forgot form must not re-send the request once one was already sent
    expect(source).toMatch(/if \(!forgotRequested\) void handleForgotPassword\(\)/)
  })

  it('every password input declares name + autoComplete', () => {
    // Extract each <Input ... /> block and check the password ones.
    const blocks = source.match(/<Input\b[\s\S]*?\/>/g) ?? []
    const passwords = blocks.filter((b) => b.includes('type="password"'))
    expect(passwords.length, 'auth page should have password inputs').toBeGreaterThanOrEqual(3)
    for (const p of passwords) {
      expect(p, 'password input needs a name').toMatch(/\bname="/)
      expect(p, 'password input needs autoComplete').toMatch(/autoComplete=/)

      // autoComplete may be static ("new-password") or dynamic
      // ({mode === 'login' ? 'current-password' : 'new-password'}) — the shared
      // login/signup field legitimately switches token by mode. Both are valid;
      // what matters is that every token present is a real credential token.
      // Match BOTH quote styles: the static form is autoComplete="new-password"
      // (double quotes) while the dynamic form uses 'current-password' / 'new-password'
      // inside a JSX expression (single quotes). A single-quote-only pattern
      // silently found zero tokens on the three static fields.
      const tokens = [...p.matchAll(/["'](current-password|new-password)["']/g)].map((m) => m[1])
      expect(tokens.length, 'must reference credential autocomplete tokens').toBeGreaterThan(0)

      const staticToken = p.match(/autoComplete="([^"]+)"/)?.[1]
      if (staticToken === 'current-password') {
        // only the shared login field may use current-password, and only via the
        // dynamic branch — a hardcoded current-password on a reset/confirm field
        // would make browsers offer to autofill the OLD password there.
        throw new Error('a reset/confirm field must never use current-password')
      }
      if (staticToken) {
        expect(
          ['current-password', 'new-password'],
          `static autoComplete="${staticToken}" must be a credential token`,
        ).toContain(staticToken)
      } else {
        // dynamic form: must branch on the mode so login never asks for a NEW
        // password and signup never offers to autofill a saved one.
        expect(p).toMatch(/autoComplete=\{mode === 'login' \? 'current-password' : 'new-password'\}/)
      }
    }
  })

  it('every email input declares name=email + autoComplete=username', () => {
    const blocks = source.match(/<Input\b[\s\S]*?\/>/g) ?? []
    const emails = blocks.filter((b) => b.includes('type="email"'))
    expect(emails.length).toBeGreaterThanOrEqual(2) // login/signup + forgot-password
    for (const e of emails) {
      expect(e).toMatch(/name="email"/)
      expect(e).toMatch(/autoComplete="username"/)
    }
  })

  it('signup identity fields use the correct autocomplete tokens', () => {
    expect(source).toMatch(/autoComplete="name"/)
    expect(source).toMatch(/autoComplete="organization"/)
  })

  it('the reset-token field is marked one-time-code (never autofilled as a password)', () => {
    const blocks = source.match(/<Input\b[\s\S]*?\/>/g) ?? []
    const token = blocks.find((b) => b.includes('resetToken'))
    expect(token, 'reset token input must exist').toBeDefined()
    expect(token).toMatch(/autoComplete="one-time-code"/)
  })

  it('does not autofill-confirm the new password as current-password', () => {
    // A common bug: confirm-password given autoComplete="current-password".
    const blocks = source.match(/<Input\b[\s\S]*?\/>/g) ?? []
    for (const b of blocks) {
      if (b.includes('confirmPassword') || b.includes('signupConfirmPassword')) {
        expect(b).toMatch(/autoComplete="new-password"/)
        expect(b).not.toContain('current-password')
      }
    }
  })

  it('keeps native validation working: form submit is prevented then handled', () => {
    // Wrapping in <form> means a real submit event now fires; it must be handled
    // or the page will do a full navigation and lose SPA state.
    expect(source).toMatch(/event\.preventDefault\(\)|e\.preventDefault\(\)/)
  })

  it('labels are bound to inputs via htmlFor/id (required for autofill UX)', () => {
    const labels = source.match(/<Label\b[^>]*>/g) ?? []
    const bound = labels.filter((l) => l.includes('htmlFor='))
    expect(bound.length, 'credential labels should be bound to their input').toBeGreaterThanOrEqual(2)
  })
})
