import type { MetadataRoute } from 'next'

/**
 * PWA manifest — "Add to Home Screen" support (v1.4 requirement, deferred from PR #173
 * per Sentinel's ruling that PWA ships as its own dedicated PR).
 *
 * No service worker is registered: offline caching for an authenticated,
 * real-time CRM would risk serving stale tenant data. Installability +
 * standalone display + theming is the goal here, not offline mode.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'King CRM Hub — Client Pipeline for Freelancers',
    short_name: 'King CRM Hub',
    description: 'Lead capture, follow-up automation, tasks, appointments, and AI guidance in one workspace.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#fcf8ec',
    theme_color: '#127c66',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
