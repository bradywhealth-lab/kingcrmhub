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

    // NAMES THE FIELD: the FIELD_MESSAGES map must key the logo path to a
    // message that names the field — the rendered alert prints this state
    // value, so a generic server string ("Invalid request body") fails this
    // pin even though the static label contains "Logo URL"
    // (cubic 4170296703: the old /Logo URL/ match hit the label, not the error).
    const mapIdx = org.indexOf('FIELD_MESSAGES')
    expect(mapIdx, 'FIELD_MESSAGES map must exist').toBeGreaterThanOrEqual(0)
    const mapEnd = org.indexOf('}', org.indexOf('logo:', mapIdx))
    const fieldMap = mapEnd > mapIdx ? org.slice(mapIdx, mapEnd + 1) : ''
    expect(
      fieldMap,
      'FIELD_MESSAGES must map the logo path to a message that names the field ' +
        '("Logo URL must be a valid web address…") — the rendered alert text comes from this map'
    ).toMatch(/logo:\s*"Logo URL must be a valid web address/)

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

  it('the alert is programmatically associated with the logo input (aria-describedby)', () => {
    const org = organizationStepSource()

    // The alert element must carry a stable id the input can reference.
    // role="alert" alone announces on appearance but a screen-reader user
    // revisiting the field hears nothing (codex 4170286856, cubic 4170296698).
    const alertIdx = org.indexOf('role="alert"')
    expect(alertIdx, 'inline error alert element must exist').toBeGreaterThanOrEqual(0)
    const alertStart = org.lastIndexOf('<p', alertIdx)
    const alertEnd = org.indexOf('</p>', alertIdx)
    const alertEl = alertStart >= 0 && alertEnd > alertStart ? org.slice(alertStart, alertEnd + 4) : ''
    expect(
      alertEl,
      'alert element must carry id="logo-error" so the input can reference it'
    ).toContain('id="logo-error"')

    // The logo input must reference the alert while the error is active and
    // drop the reference when no error is shown. aria-describedby is chosen
    // over aria-errormessage because aria-errormessage has inconsistent
    // screen-reader support and only takes effect alongside aria-invalid;
    // aria-describedby is universally announced.
    const valueIdx = org.indexOf('value={logo}')
    expect(valueIdx, 'the logo input must exist').toBeGreaterThanOrEqual(0)
    const inputStart = org.lastIndexOf('<Input', valueIdx)
    const inputEnd = org.indexOf('/>', valueIdx)
    const logoInput = inputStart >= 0 && inputEnd > inputStart ? org.slice(inputStart, inputEnd + 2) : ''
    expect(
      logoInput,
      'logo input must set aria-describedby to the alert id while the error is active, ' +
        'and drop it when no error is shown'
    ).toContain('aria-describedby={fieldError ? "logo-error" : undefined}')
  })

  it('only a matched FIELD_MESSAGES issue pins the inline error; other failures stay toast-only', () => {
    const org = organizationStepSource()

    // The catch block must not pin ANY error message to the field: network
    // errors, 429/500 responses, and non-logo zod issues (e.g. a >120-char
    // name) have no FIELD_MESSAGES hit and must stay toast-only
    // (codex 4170286852, cubic 4170296701).
    const catchIdx = org.indexOf('} catch (error)')
    expect(catchIdx, 'handleSave catch block must exist').toBeGreaterThanOrEqual(0)
    const finallyIdx = org.indexOf('} finally {', catchIdx)
    const catchRaw = finallyIdx > catchIdx ? org.slice(catchIdx, finallyIdx) : ''
    let catchBlock = catchRaw

    // A FieldError-guarded setFieldError is the ONLY sanctioned call in the
    // catch: remove the guard block before scanning, then require no naked
    // setFieldError remains. This kills the original defect (an unconditional
    // pin for every failure) while allowing the instanceof-gated pin.
    const guardStart = catchBlock.indexOf('if (error instanceof FieldError)')
    if (guardStart >= 0) {
      const guardEnd = catchBlock.indexOf('}', catchBlock.indexOf('setFieldError(', guardStart))
      if (guardEnd > guardStart) {
        catchBlock = catchBlock.slice(0, guardStart) + catchBlock.slice(guardEnd + 1)
      }
    }
    expect(
      catchBlock,
      'every setFieldError in the catch block must be inside the FieldError guard — ' +
        'request-level failures (network, 429, 500, non-logo zod issues) must stay toast-only ' +
        'and never pin to the logo input'
    ).not.toContain('setFieldError(')

    // The FIELD_MESSAGES hit branch must throw the tagged FieldError carrying
    // the mapped message, and the catch guard must set the field error from
    // it — together that is the full wiring "matched issue → fieldError state".
    const findIdx = org.indexOf('issues.find(')
    expect(findIdx, 'issues lookup must exist').toBeGreaterThanOrEqual(0)
    const afterFind = org.slice(findIdx)
    const nextAdvance = afterFind.indexOf('onNext()')
    const issueBranch = nextAdvance > -1 ? afterFind.slice(0, nextAdvance) : afterFind
    expect(
      issueBranch,
      'a matched FIELD_MESSAGES issue must throw the tagged FieldError carrying the mapped ' +
        'message so only logo validation failures reach the field-error pin'
    ).toContain('throw new FieldError(FIELD_MESSAGES[issue.path])')
    expect(
      catchRaw,
      'the catch guard must set the field error from the tagged FieldError (the only pin path)'
    ).toContain('setFieldError(message)')
  })
})
