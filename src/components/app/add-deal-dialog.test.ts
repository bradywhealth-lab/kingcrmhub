import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * S29 — "Add Deal" opened the Add LEAD form.
 *
 * ## Root cause (measured)
 * `src/app/page.tsx:1630` renders:
 *   <Button ... onClick={() => window.dispatchEvent(new CustomEvent("open-add-lead"))}>Add Deal</Button>
 * The ONLY listener in the repo is `use-workspace-overlays.ts:35`
 *   window.addEventListener("open-add-lead", leadHandler)
 * which opens the lead dialog. There is no `open-add-deal` event anywhere.
 *
 * ## Why this is a wiring fix, not a new API
 * `POST /api/pipeline` already creates a pipeline item — `createPipelineItemSchema`
 * accepts { stageId?, leadId?, title (required), value?, probability?, expectedClose? }
 * and the handler creates `db.pipelineItem`. So a real deal form only needs to
 * POST to an endpoint that already exists.
 *
 * ## Honest limitation
 * No jsdom here, so this asserts source wiring + a pure payload builder. The real
 * proof (click Add Deal → deal dialog → item appears on the board) is the live
 * post-deploy pass owned by OpsForge/Sentinel.
 */

const SRC = join(process.cwd(), 'src')

import { buildCreateDealPayload, validateDealDraft } from './add-deal-payload'

// Module-scope: several describe blocks assert against the same sources.
const page = readFileSync(join(SRC, 'app/page.tsx'), 'utf8')
const overlays = readFileSync(join(SRC, 'components/app/use-workspace-overlays.ts'), 'utf8')

describe('S29: deal draft payload builder (pure, unit-testable)', () => {
  it('builds the exact body POST /api/pipeline accepts', () => {
    expect(buildCreateDealPayload({ title: 'Acme renewal', value: '5000', stageId: 'st_1' })).toEqual({
      title: 'Acme renewal',
      value: 5000,
      stageId: 'st_1',
    })
  })

  it('trims the title and omits blank optional fields', () => {
    expect(buildCreateDealPayload({ title: '  Acme  ', value: '', stageId: '' })).toEqual({
      title: 'Acme',
    })
  })

  it('coerces numeric strings and keeps zero (a $0 deal is valid)', () => {
    expect(buildCreateDealPayload({ title: 'T', value: '0', stageId: '' })).toEqual({ title: 'T', value: 0 })
    expect(buildCreateDealPayload({ title: 'T', value: '12.5', stageId: '' })).toEqual({ title: 'T', value: 12.5 })
  })

  it('never sends NaN or negative value (schema is nonnegative)', () => {
    expect(buildCreateDealPayload({ title: 'T', value: 'abc', stageId: '' })).toEqual({ title: 'T' })
    expect(buildCreateDealPayload({ title: 'T', value: '-5', stageId: '' })).toEqual({ title: 'T' })
  })

  it('validation requires a title and reports a human reason', () => {
    expect(validateDealDraft({ title: '', value: '', stageId: '' })).toEqual({
      ok: false,
      reason: 'Give the deal a name.',
    })
    expect(validateDealDraft({ title: '   ', value: '', stageId: '' }).ok).toBe(false)
    expect(validateDealDraft({ title: 'Acme', value: '', stageId: '' })).toEqual({ ok: true })
  })

  it('rejects a title over the API max (200) instead of 400ing silently', () => {
    const long = 'x'.repeat(201)
    const r = validateDealDraft({ title: long, value: '', stageId: '' })
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/200/)
  })
})

describe('S29: "Add Deal" is wired to a deal dialog, not the lead form', () => {

  it('the Add Deal button dispatches open-add-deal', () => {
    const idx = page.indexOf('Add Deal')
    expect(idx, 'Add Deal button must exist').toBeGreaterThan(-1)
    const region = page.slice(Math.max(0, idx - 400), idx)
    expect(region, 'the button preceding "Add Deal" must dispatch open-add-deal').toContain('open-add-deal')
    expect(region).not.toContain('open-add-lead')
  })

  it('NO button labelled "Add Deal" can open the lead form (the actual bug)', () => {
    // The defect was semantic, not structural: two buttons both said "Add Deal"
    // and both dispatched open-add-lead. Assert every "Add Deal" occurrence is
    // preceded by an open-add-deal dispatch, so the mislabelling cannot return.
    const idxs = [...page.matchAll(/Add Deal/g)].map((m) => m.index as number)
    expect(idxs.length, 'expected the header button and the stage "+" tooltip').toBeGreaterThanOrEqual(1)
    for (const i of idxs) {
      const before = page.slice(Math.max(0, i - 500), i)
      if (before.includes('dispatchEvent')) {
        expect(before.slice(before.lastIndexOf('dispatchEvent')), `"Add Deal" at ${i} must dispatch open-add-deal`)
          .toContain('open-add-deal')
      }
    }
    // And the inverse: nothing on the page dispatches the lead event anymore.
    expect(page).not.toContain('open-add-lead')
  })

  it('the lead dialog is STILL reachable — no functionality was lost', () => {
    // The two "Add Deal" buttons were the ONLY dispatchers of open-add-lead, so
    // after the fix that event has no in-repo senders. The listener is retained
    // for compatibility, and the lead dialog remains reachable through the
    // onAddLead prop instead: LeadsView's "Add lead" button, the app-shell "New"
    // button, and the command palette.
    expect(overlays).toContain('addEventListener("open-add-lead"')
    // page.tsx passes the opener down as a prop (LeadsView button, AppShell, palette)
    expect(page).toMatch(/onAddLead=\{\(\) => setShowAddLeadDialog\(true\)\}/)
    expect(page).toMatch(/case "leads": return <LeadsView[^>]*onAddLead=/)
    // the dialog element itself lives in workspace-overlays.tsx, NOT page.tsx
    const overlayFile = readFileSync(join(SRC, 'components/app/workspace-overlays.tsx'), 'utf8')
    expect(overlayFile).toContain('<AddLeadDialog')
    expect(overlayFile).toContain('<AddDealDialog')
  })

  it('something listens for open-add-deal and opens a deal dialog', () => {
    expect(overlays).toContain('addEventListener("open-add-deal"')
    expect(overlays).toMatch(/showAddDealDialog/)
  })

  it('a real AddDealDialog component POSTs to /api/pipeline', () => {
    const dlg = readFileSync(join(SRC, 'components/app/add-deal-dialog.tsx'), 'utf8')
    expect(dlg).toContain('/api/pipeline')
    expect(dlg).toMatch(/method:\s*"POST"/)
    expect(dlg).toContain('buildCreateDealPayload')
    // must be a real form with a title field
    expect(dlg).toMatch(/<form/)
    expect(dlg).toMatch(/Add deal|Create deal/)
    // and must not be a copy of the lead form
    expect(dlg).not.toContain('/api/leads')
  })

  it('the dialog is rendered by the workspace overlays', () => {
    const wo = readFileSync(join(SRC, 'components/app/workspace-overlays.tsx'), 'utf8')
    expect(wo).toContain('AddDealDialog')
    expect(wo).toMatch(/showAddDealDialog/)
  })
})

describe('S29: the dialog reads the REAL pipeline response shape', () => {
  // GET /api/pipeline returns { pipeline: { stages: [...] }, metrics: {...} }.
  // My first version read payload.stages (top level), which silently loads ZERO
  // stages and leaves the select empty. Caught by checking the API source rather
  // than assuming the shape.
  const dlg = readFileSync(join(SRC, 'components/app/add-deal-dialog.tsx'), 'utf8')
  const api = readFileSync(join(SRC, 'app/api/pipeline/route.ts'), 'utf8')

  it('the API really nests stages under `pipeline`', () => {
    expect(api).toMatch(/return NextResponse\.json\(\{\s*pipeline,/)
  })

  it('the dialog reads pipeline.stages, NOT top-level stages', () => {
    expect(dlg).toContain('payload?.pipeline?.stages')
    expect(dlg).not.toMatch(/Array\.isArray\(payload\?\.stages\)/)
  })

  it('the dialog surfaces an API error instead of silently showing no stages', () => {
    expect(dlg).toMatch(/payload\?\.error/)
  })

  it('surfaces field-level 400 issues rather than the generic body error', () => {
    // parseJsonBody returns { error: 'Invalid request body', issues: [{path,message}] }
    expect(dlg).toContain('payload.issues')
    expect(dlg).toContain('.path')
  })
})

describe('S29: the board actually refreshes after a deal is created', () => {
  // Without this, a new deal would not appear until a page reload — the fix would
  // look broken to the user even though the POST succeeded.
  it('PipelineView accepts a refreshKey and its loader depends on it', () => {
    expect(page).toMatch(/function PipelineView\(\{ refreshKey = 0 \}: \{ refreshKey\?: number \}\)/)

    // STRIP COMMENTS before asserting. Mutation testing caught this test passing
    // vacuously: my own explanatory comment literally contained the string
    // "`}, [refreshKey])` at its loader", so the regex matched the documentation
    // instead of the dependency array. A test that matches its own comment is
    // worthless — it stays green when the real code is reverted.
    const code = page.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

    const loaderStart = code.indexOf('const loadPipeline = useCallback(async () => {')
    expect(loaderStart, 'loadPipeline must exist').toBeGreaterThan(-1)
    // Anchor on the loader's OWN closing dep array: the first `}, [...])` after it.
    const closeIdx = code.indexOf('}, [', loaderStart)
    expect(closeIdx).toBeGreaterThan(loaderStart)
    const depArray = code.slice(closeIdx, code.indexOf(']', closeIdx) + 1)
    expect(depArray, 'loadPipeline must re-run when refreshKey changes').toBe('}, [refreshKey]')
  })

  it('the refreshKey comment-stripping guard is not vacuous (self-check)', () => {
    // Proves the strip really removes the comment that used to satisfy the test.
    const code = page.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
    expect(code).not.toContain('mirrors')
    expect(code).not.toContain('established LeadsView pattern')
  })

  it('the render site passes the hook key through', () => {
    expect(page).toContain('<PipelineView refreshKey={pipelineRefreshKey} />')
  })

  it('the hook exposes a refresh key bumped by handleDealCreated', () => {
    expect(overlays).toContain('pipelineRefreshKey')
    expect(overlays).toMatch(/setPipelineRefreshKey\(\(current\) => current \+ 1\)/)
  })

  it('the stage-header "+" passes its stage so the deal lands there by default', () => {
    expect(page).toMatch(/open-add-deal", \{ detail: \{ stageId: stage\.id \} \}/)
    expect(overlays).toMatch(/detail\?\.stageId/)
  })
})
