import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * S29 re-verification (task t_c5a2d2be) — persistence-chain guards.
 *
 * Sentinel's second-verifier sweep (t_900bf0e9) reported the S29 deal dialog as
 * "does not persist after reload". Re-verification DISPROVED that: a read-only
 * production-DB probe found both of Sentinel's own test deals persisted in the
 * exact stage their column promised ("Contacted"), hours after creation, with a
 * single default pipeline (no duplicate-pipeline race). The chain below is
 * therefore verified-correct behavior; these guards PIN it so a future edit that
 * silently breaks persistence (e.g. dropping the onCreated → pipeline-refresh
 * wiring, or POSTing without stageId) fails CI instead of shipping.
 *
 * ## Honest limitation
 * This project has no jsdom, so there is no component test that submits the
 * dialog and re-renders the board. Like `stage-selection.test.ts`, the check is
 * a source guard over the exact wiring — the strongest static check available
 * here, not equivalent to rendering the component. Live behavior was verified
 * separately against production (DB probe + DOM evidence, t_c5a2d2be).
 */
describe('S29 persistence chain — the creation actually reaches the board', () => {
  const dialogSource = readFileSync(join(process.cwd(), 'src/components/app/add-deal-dialog.tsx'), 'utf8')
  const pageSource = readFileSync(join(process.cwd(), 'src/app/page.tsx'), 'utf8')

  it('the dialog POSTs the resolved stage id (never omits it)', () => {
    // Persistence-defect class: a POST without stageId silently lands the deal in
    // the first stage, so the board appears to "lose" it.
    expect(dialogSource).toMatch(/stageId:\s*form\.stageId/)
  })

  it('the dialog POSTs every user-entered field', () => {
    expect(dialogSource).toMatch(/title:\s*form\.title\.trim\(\)/)
    expect(dialogSource).toMatch(/value:\s*form\.value \? Number\(form\.value\) : undefined/)
    expect(dialogSource).toMatch(/expectedClose:\s*form\.expectedClose \|\| undefined/)
  })

  it('the dialog surfaces a failed POST instead of closing silently', () => {
    // The reported "does not persist" symptom would also occur if a failed POST
    // closed the dialog as if it had succeeded.
    expect(dialogSource).toMatch(/if \(!response\.ok\) \{[\s\S]{0,200}throw new Error/)
  })

  it('closes the dialog and signals creation ONLY on the success path (cubic P2)', () => {
    // The success sequence must live inside the try AFTER response.ok was
    // checked, and the catch must not close the dialog — otherwise a failed
    // POST still closes as if it had persisted.
    const okChecked = dialogSource.indexOf('if (!response.ok) {')
    const closeIdx = dialogSource.indexOf('onOpenChange(false)')
    const createdIdx = dialogSource.indexOf('onCreated?.()')
    expect(okChecked, 'the non-OK branch must exist').toBeGreaterThanOrEqual(0)
    expect(closeIdx, 'the dialog close must exist').toBeGreaterThan(okChecked)
    expect(createdIdx, 'onCreated must fire after the non-OK guard').toBeGreaterThan(closeIdx)
    // The catch branch must recover with a user-visible error, never a close:
    const catchIdx = dialogSource.indexOf('} catch (err) {')
    expect(catchIdx).toBeGreaterThan(createdIdx)
    const catchSlice = dialogSource.slice(catchIdx, catchIdx + 300)
    expect(catchSlice).toContain('setError')
    expect(catchSlice, 'a failed create must leave the dialog open').not.toContain('onOpenChange(false)')
  })

  it('the dialog signals creation so the board can reload', () => {
    expect(dialogSource).toContain('onCreated?.()')
  })

  it('the page wires onCreated to the pipeline-refresh event', () => {
    expect(pageSource).toMatch(/onDealCreated=\{\(\) => \{ window\.dispatchEvent\(new CustomEvent\("pipeline-refresh"\)\) \}\}/)
  })

  it('PipelineView listens for pipeline-refresh and reloads the board', () => {
    expect(pageSource).toMatch(/window\.addEventListener\("pipeline-refresh",\s*requestPipelineRefresh\)/)
    expect(pageSource).toMatch(/requestPipelineRefresh[\s\S]{0,200}void loadPipeline\(\)/)
  })

  it('a creation refresh is deferred while a drag is in flight (no stale GET)', () => {
    expect(pageSource).toMatch(/moveInFlightRef\.current > 0[\s\S]{0,80}refreshQueuedRef\.current = true/)
  })

  it('the queued refresh is eventually drained after the drag settles (cubic P2)', () => {
    // Deferring is only correct if the finally block drains the queue once the
    // last move lands; otherwise a mid-drag create would never reach the board.
    const drain = /if \(moveInFlightRef\.current === 0 && refreshQueuedRef\.current\) \{\s*refreshQueuedRef\.current = false\s*void loadPipeline\(\)\s*\}/
    expect(pageSource, 'the drag-settle path must drain the queued refresh').toMatch(drain)
    // The drain must live in the finally block, so it runs even when the move
    // request itself failed.
    const drainIdx = pageSource.search(/if \(moveInFlightRef\.current === 0 && refreshQueuedRef\.current\)/)
    const finallyIdx = pageSource.lastIndexOf('} finally {', drainIdx)
    const closeBrace = pageSource.indexOf('}', drainIdx)
    expect(finallyIdx, 'the drain must sit inside a finally block').toBeGreaterThan(-1)
    expect(closeBrace, 'the drain must not outlive its finally block').toBeGreaterThan(finallyIdx)
  })
})
