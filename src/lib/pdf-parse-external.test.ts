import { describe, expect, it } from 'vitest'
import nextConfig from '../../next.config'

describe('M159 bundling guard', () => {
  it('externalizes pdf-parse from the server bundle in next.config.ts', () => {
    // M159 regression: Turbopack inlining pdf-parse breaks the pdfjs worker
    // asset at runtime ("Setting up fake worker failed"). The runtime unit
    // tests resolve pdf-parse from node_modules directly, so they cannot
    // catch a bundling reintroduction — the config flag is the guard.
    expect(nextConfig.serverExternalPackages).toContain('pdf-parse')
  })
})
