import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * S20 follow-up — inline text links must clear WCAG 2.2 SC 2.5.8 (24x24 CSS px).
 *
 * ## What #223/#225 already fixed (merged, live — NOT re-done here)
 * #223 raised the /claim, /terms and /privacy links to `min-h-[24px]`; Atlas and
 * OpsForge both re-measured them at 24.0px on the deployed build.
 *
 * ## What was still failing (Atlas measured live on `afe3b4f`)
 * - `/welcome`: **12** nav/footer links at exactly **20px** (5 header, 7 footer)
 * - `/auth`: the **"Forgot password?"** control at **20px**
 *
 * Both now declare `min-h-[24px]`. The rule below: any Link/anchor on /welcome
 * that has no vertical padding (i.e. an inline text link, not a padded CTA) must
 * declare the 24px floor. Padded CTAs are already >24px via their own padding.
 *
 * ## Honest limitation
 * These are source assertions — there is no jsdom in this repo. They prove the
 * markup carries the floor; the real proof is a browser getBoundingClientRect
 * measurement on the deployed build.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

const WELCOME = 'src/app/welcome/page.tsx'
const AUTH = 'src/app/auth/page.tsx'

describe('tap targets (S20)', () => {
  it('every unpadded /welcome link carries the 24px floor', () => {
    const tags = read(WELCOME).match(/<(?:Link|a)\b[^>]*>/g) ?? []
    const inline = tags.filter((t) => !/py-\d/.test(t))

    expect(inline.length).toBeGreaterThan(9) // 5 header + 7 footer
    for (const tag of inline) expect(tag).toContain('min-h-[24px]')
  })

  it('the /auth "Forgot password?" control carries the 24px floor', () => {
    const src = read(AUTH)
    const at = src.indexOf("switchMode('forgot')")
    expect(at).toBeGreaterThan(-1)

    const tag = src.slice(src.lastIndexOf('<button', at), src.indexOf('>', at))
    expect(tag).toContain('min-h-[24px]')
  })
})