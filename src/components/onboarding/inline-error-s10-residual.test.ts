import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = join(import.meta.dirname, '..', '..', '..')
const wizardSrc = readFileSync(
  join(repoRoot, 'src', 'components', 'onboarding', 'onboarding-wizard.tsx'),
  'utf8'
)

// Extract the OrganizationStep function body (step 1 of the onboarding wizard).
// Delimited so assertions pin the org step only and cannot be satisfied by
// another step's handler.
function organizationStepSource(): string {
  const start = wizardSrc.indexOf('function OrganizationStep')
  expect(start, 'OrganizationStep component must exist').toBeGreaterThanOrEqual(0)
  const next = wizardSrc.indexOf('\nfunction ', start + 1)
  return wizardSrc.slice(start, next === -1 ? undefined : next)
}

/**
 * S10 residual regression gate (t_5aa6676b, live-measured 2026-10-02 by
 * CodeForge runs 223+244 on fresh orgs 1003+1005):
 *
 * Submitting an INVALID non-empty logo ("ht!tp://not a url %%") at onboarding
 * step 1 returns server 400 via parseJsonBody ({error, issues}) but the client
 * showed ONLY a transient destructive toast "Save failed / Invalid request
 * body". That toast (a) does not name the field, (b) auto-dismisses, and (c)
 * is not bound to the logo input — measured inline_error_elements = 0 (no
 * [role=alert], no aria-invalid, no field-pinned message).
 *
 * The S10 card's bar: "a specific, visible, accessible inline error naming the
 * field" for ANY field that can block Save & continue. The empty-optional path
 * was fixed by #223 (bare domains accepted, '' accepted); the invalid-value
 * path still fails that bar.
 *
 * FIX (this gate pins it): the OrganizationStep catch block must derive a
 * field-level message from the 400's zod issues and render a PERSISTENT inline
 * error pinned to the offending field — role="alert" (implicitly aria-live)
 * + aria-invalid="true" on the input — naming the field.
 */
describe('S10 residual — invalid input surfaces a field-level accessible inline error', () => {
  it('a 400 issues payload is mapped to a named field error, not a generic toast message', () => {
    const org = organizationStepSource()

    // The 400's issues array must be mapped to a human message naming the
    // field: look up the offending field's path ("logo") in the issues list
    // and use its server-side zod message. A path->message map is the render
    // source; without it the catch path can only surface the generic string.
    expect(
      org.match(/issues/),
      'handleSave must consume the 400 issues array to derive a field-level message ' +
        'instead of surfacing only the generic "Invalid request body" error string'
    ).not.toBeNull()
    expect(
      org.match(/path/),
      'the issues lookup must key on the issue path ("logo") so the message names the field'
    ).not.toBeNull()
    expect(
      org.match(/\.message/),
      'the field message must come from the server issue\'s zod message'
    ).not.toBeNull()

    // The derived message must be stored in state so it renders inline.
    expect(
      org.match(/setFieldError\(/),
      'field error must be set in component state so it can render pinned to the field'
    ).not.toBeNull()
  })

  it('the inline error is persistent, visible, and names the offending field', () => {
    const org = organizationStepSource()

    // PERSISTENT + ACCESSIBLE: rendered as an alert element in the step body
    // (role="alert" — implicitly aria-live="assertive"), NOT only in the
    // auto-dismissing toast system.
    expect(
      org.match(/role="alert"/),
      'inline error must render with role="alert" so screen readers announce it and it ' +
        'persists in the DOM (the toast auto-dismisses)'
    ).not.toBeNull()

    // NAMES THE FIELD: the user-visible text identifies the offending field.
    expect(
      org.match(/Logo URL/),
      'inline error text must name the field (e.g. "Logo URL must be a valid web address")'
    ).not.toBeNull()

    // BOUND TO THE INPUT: aria-invalid="true" on the logo input when the error
    // is active, so assistive tech ties the message to the field. The logo
    // input is identified by its value={logo} binding (unambiguous in this
    // step); slice from its opening tag through its closing />. A single-tag
    // regex cannot cross the multi-line onChange arrow, so a window slice is
    // the robust pin.
    const valueIdx = org.indexOf('value={logo}')
    expect(valueIdx, 'the logo input must exist').toBeGreaterThanOrEqual(0)
    const inputStart = org.lastIndexOf('<Input', valueIdx)
    const inputEnd = org.indexOf('/>', valueIdx)
    const logoInput = inputStart >= 0 && inputEnd > inputStart ? org.slice(inputStart, inputEnd + 2) : ''
    expect(
      logoInput,
      'logo input must carry aria-invalid when the field error is active'
    ).toContain('aria-invalid={')

    // The rendered error message must come from the field-error state (not a
    // hardcoded literal that could drift from the actual failure): the alert
    // renders the state value directly. \s* spans JSX indentation.
    expect(
      org.match(/<p[^>]*role="alert"[^>]*>\s*\{fieldError\}\s*<\/p>/),
      'rendered inline error text must render the fieldError state'
    ).not.toBeNull()
  })

  it('an empty optional logo still advances (no regression on the #223 fix)', () => {
    const org = organizationStepSource()

    // #223 accepted '' for logo; the client still omits it from the payload
    // when empty, so the optional path keeps advancing.
    expect(
      org.match(/logo: logo\.trim\(\) \|\| undefined/),
      'empty logo must still be omitted from the PATCH payload (guard against regression)'
    ).not.toBeNull()

    // Clearing the error when the user edits the field keeps a stale message
    // from persisting after a valid retry.
    expect(
      org.match(/onChange=\{\(e\) => \{\s*setLogo\(e\.target\.value\)/),
      'logo onChange must clear a stale field error when the user edits the value'
    ).not.toBeNull()
  })

  it('saving state and finally-setSaving(false) are unchanged (no regression)', () => {
    const org = organizationStepSource()

    expect(org.match(/setSaving\(true\)/)).not.toBeNull()
    expect(org.match(/finally\s*\{\s*setSaving\(false\)/)).not.toBeNull()
    expect(
      org.match(/disabled=\{saving\}/),
      'Save button must stay disabled while saving'
    ).not.toBeNull()
  })
})
