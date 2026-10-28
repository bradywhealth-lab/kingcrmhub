import { describe, it, expect } from 'vitest'

import manifest from '../manifest'
import { GET } from './route'

// /manifest.json is the conventional PWA manifest path that browsers,
// crawlers, and audit tooling probe. This route must serve the SAME manifest
// as app/manifest.ts (/manifest.webmanifest) — a forked copy would drift and
// break install metadata (Sentinel SENT-20261027-002).
describe('GET /manifest.json', () => {
  it('serves the app/manifest.ts builder at the conventional path', async () => {
    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/manifest+json')
    await expect(response.json()).resolves.toEqual(manifest())
  })

  it('keeps the PWA-critical fields installability depends on', async () => {
    const body = await (await GET()).json()

    expect(body.name).toBeTruthy()
    expect(body.short_name).toBeTruthy()
    expect(body.start_url).toBe('/')
    expect(body.display).toBe('standalone')
    const sizes: string[] = body.icons.map((icon: { sizes: string }) => icon.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
  })
})
