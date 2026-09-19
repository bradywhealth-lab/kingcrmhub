import { AuthLoadingSkeleton } from '@/components/auth/auth-loading'

/**
 * App-Router loading boundary for the /auth segment (covers /auth,
 * /auth?mode=signup, /auth/invite, /auth/password).
 *
 * Zero-blip contract: every render of this surface must paint the branded
 * skeleton from the FIRST frame — never a blank window. Next.js streams
 * this file's output into the initial HTML payload, so it shows the moment
 * the shell arrives, well before the client form hydrates.
 */
export default function AuthLoading() {
  return <AuthLoadingSkeleton />
}
