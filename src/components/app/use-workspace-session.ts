"use client"

import { useCallback, useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { getSession, signOut as nextAuthSignOut } from "next-auth/react"

export type WorkspaceUser = {
  id: string
  email: string
  name: string | null
  role: string
  organizationId: string
  organization?: { id: string; name: string; slug: string; plan: string }
  mustChangePassword?: boolean
}

export function useWorkspaceSession() {
  const router = useRouter()
  const pathname = usePathname()
  const [authLoading, setAuthLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<WorkspaceUser | null>(null)

  useEffect(() => {
    let cancelled = false
    const isAuthRoute = pathname?.startsWith("/auth") ?? false

    ;(async () => {
      try {
        const session = await getSession()
        if (cancelled) return

        if (!session?.user) {
          setCurrentUser(null)
          if (!isAuthRoute) router.replace("/auth")
          return
        }

        if (session.user.mustChangePassword) {
          setCurrentUser(session.user as WorkspaceUser)
          if (pathname !== "/auth/password") {
            router.replace("/auth/password")
          }
          return
        }

        setCurrentUser(session.user as WorkspaceUser)

        if (isAuthRoute) {
          router.replace("/")
          router.refresh()
        }
      } catch {
        setCurrentUser(null)
        if (!cancelled && !isAuthRoute) router.replace("/auth")
      } finally {
        if (!cancelled) setAuthLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [pathname, router])

  const signOut = useCallback(async () => {
    try {
      await nextAuthSignOut({ redirect: false })
    } finally {
      router.replace("/auth")
      router.refresh()
    }
  }, [router])

  return { authLoading, currentUser, signOut }
}
