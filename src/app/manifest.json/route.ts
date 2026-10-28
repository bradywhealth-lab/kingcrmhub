import { NextResponse } from 'next/server'

import manifest from '../manifest'

/**
 * Conventional-path alias of the PWA manifest at /manifest.json.
 *
 * Next.js metadata conventions expose app/manifest.ts at /manifest.webmanifest
 * only. But /manifest.json is the path a range of browsers, crawlers, and PWA
 * audit tooling probe by convention — before this route existed, the request
 * hit the auth middleware and redirected to /auth (Sentinel incident
 * SENT-20261027-002), breaking install detection for anything following the
 * convention. This handler re-exports the SAME builder as app/manifest.ts:
 * one source of truth, never a forked copy (same rule as the deleted static
 * public/sitemap.xml).
 *
 * Public by design — middleware.ts excludes this path from the auth guard
 * (PUBLIC_STATIC_ASSETS + matcher); browsers fetch manifests without a
 * session during "Add to Home Screen".
 */
export const dynamic = 'force-static'

export async function GET() {
  return new NextResponse(JSON.stringify(manifest()), {
    status: 200,
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
