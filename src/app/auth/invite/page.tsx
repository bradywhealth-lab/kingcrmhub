'use client'

import { Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function InviteAcceptanceContent() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') || ''
  const email = params.get('email') || ''
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const disabled = useMemo(() => !token || !email || !password, [email, password, token])

  const submit = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          token,
          name: name.trim() || undefined,
          password,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to accept invitation')
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
        callbackUrl: '/',
      })
      if (!result || result.error) throw new Error('Failed to start a new session')
      router.replace('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[var(--paper)] text-foreground">
      <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-6 py-16">
        <Card className="w-full border-[var(--ink-line)] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-black">Accept Team Invitation</CardTitle>
            <CardDescription>Finish setting up your King CRM Hub account to join the workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input className="mt-1 bg-[var(--paper)]" value={email} disabled />
            </div>
            <div>
              <Label>Your name</Label>
              <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your full name" />
            </div>
            <div>
              <Label>Create password</Label>
              <Input className="mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button className="btn-gold w-full" onClick={() => void submit()} disabled={loading || disabled}>
              {loading ? 'Joining...' : 'Join workspace'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function InviteAcceptanceFallback() {
  return (
    <main className="min-h-screen bg-[var(--paper)] text-foreground">
      <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-6 py-16">
        <Card className="w-full border-[var(--ink-line)] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-black">Accept Team Invitation</CardTitle>
            <CardDescription>Loading your invite details…</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </main>
  )
}

export default function InviteAcceptancePage() {
  return (
    <Suspense fallback={<InviteAcceptanceFallback />}>
      <InviteAcceptanceContent />
    </Suspense>
  )
}
