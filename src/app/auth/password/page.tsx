'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { getSession, signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function PasswordSetupPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[var(--paper)] flex items-center justify-center text-gray-500">
          Loading password setup…
        </main>
      }
    >
      <PasswordSetupPageInner />
    </Suspense>
  )
}

function PasswordSetupPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Preserve the validated callbackUrl forwarded from /auth (cubic P2 round
  // 4): after forced password setup, land where the user was headed.
  const rawCallback = searchParams.get('callbackUrl') ?? '/'
  const safeCallback =
    rawCallback.startsWith('/') && !rawCallback.startsWith('//') && !rawCallback.includes('\\')
      ? rawCallback
      : '/'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const session = await getSession()
        if (cancelled) return
        if (!session?.user) {
          router.replace('/auth')
          return
        }
        setEmail(session.user.email ?? '')
        if (!session.user.mustChangePassword) {
          router.replace('/')
          return
        }
      } catch {
        if (!cancelled) router.replace('/auth')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [router])

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to update password')
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password: newPassword,
        callbackUrl: safeCallback,
      })
      if (!result || result.error) throw new Error('Failed to start a new session')
      router.replace(safeCallback)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--paper)] flex items-center justify-center text-gray-500">
        Loading password setup…
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[var(--paper)] text-foreground">
      <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-6 py-16">
        <Card className="w-full border-[var(--ink-line)] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-black">Set Your Password</CardTitle>
            <CardDescription>Finish account setup by replacing the temporary password.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Current temporary password</Label>
              <Input className="mt-1" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div>
              <Label>New password</Label>
              <Input className="mt-1" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button className="btn-gold w-full" onClick={() => void submit()} disabled={saving}>
              {saving ? 'Updating...' : 'Update password'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
