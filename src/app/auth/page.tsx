'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession, signIn } from 'next-auth/react'
import { ArrowRight, CheckCircle2, ChevronLeft, Copy, LockKeyhole, ShieldCheck, Sparkles, TrendingUp, Users } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Mode = 'login' | 'signup' | 'forgot' | 'reset'

const VALUE_POINTS = [
  {
    icon: TrendingUp,
    title: 'Close with more control',
    description: 'Pipeline, follow-up, and AI guidance in one operator-grade workspace.',
  },
  {
    icon: Users,
    title: 'Keep the whole team aligned',
    description: 'Lead handoff, activity visibility, and execution standards without chaos.',
  },
  {
    icon: ShieldCheck,
    title: 'Built for real insurance ops',
    description: 'Auth, sessions, password resets, and daily workflow guardrails that actually matter.',
  },
]

const TRUST_METRICS = [
  { label: 'Lead response discipline', value: '<5 min' },
  { label: 'Pipeline visibility', value: 'Real-time' },
  { label: 'Team accountability', value: 'Built-in' },
]

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [forgotEmail, setForgotEmail] = useState('')
  const [resetTokenDisplay, setResetTokenDisplay] = useState<string | null>(null)
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const session = await getSession()
        if (!cancelled && session?.user) {
          router.replace(session.user.mustChangePassword ? '/auth/password' : '/')
          router.refresh()
        }
      } catch {
        // stay on auth page
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  const currentModeTitle = useMemo(() => {
    switch (mode) {
      case 'signup':
        return 'Create your workspace'
      case 'forgot':
        return 'Reset access'
      case 'reset':
        return 'Set a new password'
      default:
        return 'Welcome back'
    }
  }, [mode])

  const switchMode = (next: Mode) => {
    setError(null)
    setSuccess(null)
    if (next !== 'reset') setResetTokenDisplay(null)
    setMode(next)
  }

  const handleLoginSignup = async () => {
    setLoading(true)
    setError(null)
    try {
      if (mode === 'signup') {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: signupName,
            email: signupEmail,
            password: signupPassword,
            organizationName,
          }),
        })
        const data = await res.json()
        if (!res.ok || data.error) throw new Error(data.error || 'Signup failed')
      }

      const email = mode === 'login' ? loginEmail : signupEmail
      const password = mode === 'login' ? loginPassword : signupPassword
      const result = await signIn('credentials', { redirect: false, email, password, callbackUrl: '/' })
      if (!result || result.error) throw new Error(mode === 'login' ? 'Invalid email or password.' : 'Authentication failed.')
      const session = await getSession()
      router.push(session?.user?.mustChangePassword ? '/auth/password' : '/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    setLoading(true)
    setError(null)
    setResetTokenDisplay(null)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Request failed')
      if (data.token) {
        setResetTokenDisplay(data.token)
        setSuccess('Reset token created. Copy it now, then continue to password reset.')
      } else {
        setSuccess('If that email exists, a reset token is now available through your admin flow.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    setLoading(true)
    setError(null)
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken.trim(), password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Reset failed')
      setSuccess('Password reset successfully. Sign in with your new password.')
      setMode('login')
      setLoginPassword('')
      setResetToken('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setLoading(false)
    }
  }

  const copyResetToken = async () => {
    if (!resetTokenDisplay) return
    await navigator.clipboard.writeText(resetTokenDisplay)
    setSuccess('Reset token copied to clipboard.')
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(85,125,245,0.18),transparent_32%),linear-gradient(180deg,#f9f5eb_0%,#eef3fb_100%)] px-4 py-6 lg:px-8 lg:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl overflow-hidden rounded-[32px] border border-white/60 bg-[rgba(252,252,252,0.76)] shadow-[0_30px_100px_rgba(31,42,54,0.14)] backdrop-blur-xl lg:min-h-[calc(100vh-4rem)]">
        <section className="relative hidden flex-1 overflow-hidden bg-[#0f172a] px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(85,125,245,0.35),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(58,95,217,0.28),transparent_28%)]" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#557df5,#3a5fd9)] shadow-[0_12px_32px_rgba(85,125,245,0.45)]">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">King CRM Hub</p>
                <p className="text-lg font-semibold text-white">Insurance operator workspace</p>
              </div>
            </div>
            <div className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-medium text-white/70">
              Premium CRM system
            </div>
          </div>

          <div className="relative z-10 max-w-2xl space-y-8">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#557df5]/35 bg-[#557df5]/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#cfe0ff]">
                <LockKeyhole className="h-3.5 w-3.5" /> Secure, fast, operator-grade
              </div>
              <h1 className="text-5xl font-semibold leading-[1.02] tracking-[-0.04em] text-white xl:text-6xl">
                Run the whole CRM like a control room, not a spreadsheet.
              </h1>
              <p className="max-w-xl text-lg leading-8 text-white/68">
                Leads, pipeline, automations, AI support, and team execution in one polished workspace built for serious insurance production.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {TRUST_METRICS.map((metric) => (
                <div key={metric.label} className="rounded-3xl border border-white/10 bg-white/6 p-5 shadow-[0_14px_40px_rgba(15,23,42,0.18)]">
                  <p className="text-2xl font-semibold text-white">{metric.value}</p>
                  <p className="mt-2 text-sm text-white/58">{metric.label}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {VALUE_POINTS.map((point) => (
                <div key={point.title} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#557df5]/18 text-[#cfe0ff]">
                    <point.icon className="h-5 w-5" />
                  </div>
                  <p className="text-lg font-semibold text-white">{point.title}</p>
                  <p className="mt-2 text-sm leading-6 text-white/58">{point.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 rounded-[28px] border border-white/10 bg-white/6 p-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#8dd6b4]" />
              <p className="text-sm font-medium text-white">Auth flows included: signup, login, forgot password, reset password.</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-white/58">
              Use the token-based reset flow for internal/admin-controlled recovery, then return to login without losing your workspace context.
            </p>
          </div>
        </section>

        <section className="flex w-full flex-col justify-between px-5 py-6 sm:px-8 lg:w-[520px] lg:px-10 lg:py-10 xl:w-[560px]">
          <div>
            <div className="mb-10 flex items-center justify-between lg:hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#557df5,#3a5fd9)] shadow-[0_12px_30px_rgba(85,125,245,0.32)]">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#1f2a36]/50">King CRM Hub</p>
                  <p className="text-sm font-semibold text-[#1f2a36]">Operator console</p>
                </div>
              </div>
            </div>

            <div className="mb-8 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#557df5]">Secure workspace access</p>
              <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[#1f2a36]">{currentModeTitle}</h2>
              <p className="text-sm leading-6 text-[#1f2a36]/55">
                {mode === 'login' && 'Sign in to manage leads, pipeline execution, automations, and AI workflows.'}
                {mode === 'signup' && 'Create the team workspace, owner account, and operating foundation in one move.'}
                {mode === 'forgot' && 'Request a reset token for controlled password recovery.'}
                {mode === 'reset' && 'Apply a fresh password and invalidate old sessions safely.'}
              </p>
            </div>

            {(mode === 'login' || mode === 'signup') && (
              <>
                <div className="mb-6 grid grid-cols-2 rounded-2xl border border-[rgba(31,42,54,0.08)] bg-[#f4f7fc] p-1">
                  {(['login', 'signup'] as Mode[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => switchMode(tab)}
                      className={cn(
                        'rounded-[14px] px-4 py-3 text-sm font-semibold transition-all',
                        mode === tab
                          ? 'bg-white text-[#1f2a36] shadow-[0_10px_25px_rgba(31,42,54,0.08)]'
                          : 'text-[#1f2a36]/45 hover:text-[#1f2a36]'
                      )}
                    >
                      {tab === 'login' ? 'Sign in' : 'Create account'}
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  {mode === 'signup' && (
                    <>
                      <div>
                        <Label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#1f2a36]/52">Owner name</Label>
                        <Input className="h-12 rounded-2xl border-[rgba(31,42,54,0.1)] bg-white shadow-sm" placeholder="Your name" value={signupName} onChange={(e) => setSignupName(e.target.value)} />
                      </div>
                      <div>
                        <Label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#1f2a36]/52">Organization</Label>
                        <Input className="h-12 rounded-2xl border-[rgba(31,42,54,0.1)] bg-white shadow-sm" placeholder="King CRM Insurance Group" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} />
                      </div>
                    </>
                  )}

                  <div>
                    <Label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#1f2a36]/52">Email</Label>
                    <Input
                      type="email"
                      className="h-12 rounded-2xl border-[rgba(31,42,54,0.1)] bg-white shadow-sm"
                      placeholder="you@company.com"
                      value={mode === 'login' ? loginEmail : signupEmail}
                      onChange={(e) => (mode === 'login' ? setLoginEmail(e.target.value) : setSignupEmail(e.target.value))}
                      onKeyDown={(e) => e.key === 'Enter' && void handleLoginSignup()}
                    />
                  </div>

                  <div>
                    <Label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#1f2a36]/52">Password</Label>
                    <Input
                      type="password"
                      className="h-12 rounded-2xl border-[rgba(31,42,54,0.1)] bg-white shadow-sm"
                      placeholder="••••••••"
                      value={mode === 'login' ? loginPassword : signupPassword}
                      onChange={(e) => (mode === 'login' ? setLoginPassword(e.target.value) : setSignupPassword(e.target.value))}
                      onKeyDown={(e) => e.key === 'Enter' && void handleLoginSignup()}
                    />
                  </div>

                  {mode === 'login' && (
                    <div className="flex justify-end">
                      <button type="button" onClick={() => switchMode('forgot')} className="text-sm font-medium text-[#557df5] hover:opacity-80">
                        Forgot password?
                      </button>
                    </div>
                  )}

                  {error && <StatusCard tone="error" message={error} />}
                  {success && <StatusCard tone="success" message={success} />}

                  <Button
                    onClick={() => void handleLoginSignup()}
                    disabled={loading}
                    className="h-12 w-full rounded-2xl bg-[linear-gradient(135deg,#557df5,#3a5fd9)] text-sm font-semibold text-white shadow-[0_16px_34px_rgba(85,125,245,0.28)] hover:opacity-95"
                  >
                    {loading ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create workspace'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>

                  <div className="rounded-2xl border border-[rgba(31,42,54,0.08)] bg-[#f7f4ec] p-4 text-sm text-[#1f2a36]/60">
                    Need a reset token instead?{' '}
                    <button type="button" onClick={() => switchMode('reset')} className="font-semibold text-[#557df5] hover:opacity-80">
                      Go to reset password
                    </button>
                  </div>
                </div>
              </>
            )}

            {mode === 'forgot' && (
              <div className="space-y-4">
                <button onClick={() => switchMode('login')} className="inline-flex items-center gap-2 text-sm font-medium text-[#1f2a36]/55 hover:text-[#1f2a36]">
                  <ChevronLeft className="h-4 w-4" /> Back to sign in
                </button>
                <div>
                  <Label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#1f2a36]/52">Email address</Label>
                  <Input type="email" className="h-12 rounded-2xl border-[rgba(31,42,54,0.1)] bg-white shadow-sm" placeholder="you@company.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void handleForgotPassword()} />
                </div>
                {error && <StatusCard tone="error" message={error} />}
                {success && <StatusCard tone="success" message={success} />}
                {resetTokenDisplay ? (
                  <div className="rounded-[24px] border border-[#557df5]/18 bg-[#f5f8ff] p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#557df5]">Reset token</p>
                    <div className="mt-3 flex items-center gap-2 rounded-2xl border border-[#557df5]/15 bg-white p-3">
                      <code className="min-w-0 flex-1 break-all text-xs text-[#1f2a36]">{resetTokenDisplay}</code>
                      <Button variant="outline" className="rounded-xl border-[rgba(31,42,54,0.08)]" onClick={() => void copyResetToken()}>
                        <Copy className="mr-2 h-4 w-4" /> Copy
                      </Button>
                    </div>
                    <Button className="mt-3 h-11 w-full rounded-2xl bg-[linear-gradient(135deg,#557df5,#3a5fd9)] text-white" onClick={() => { setResetToken(resetTokenDisplay); switchMode('reset') }}>
                      Continue to reset <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button onClick={() => void handleForgotPassword()} disabled={loading} className="h-12 w-full rounded-2xl bg-[linear-gradient(135deg,#557df5,#3a5fd9)] text-white shadow-[0_16px_34px_rgba(85,125,245,0.28)]">
                    {loading ? 'Generating token…' : 'Generate reset token'}
                  </Button>
                )}
              </div>
            )}

            {mode === 'reset' && (
              <div className="space-y-4">
                <button onClick={() => switchMode('forgot')} className="inline-flex items-center gap-2 text-sm font-medium text-[#1f2a36]/55 hover:text-[#1f2a36]">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <div>
                  <Label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#1f2a36]/52">Reset token</Label>
                  <Input className="h-12 rounded-2xl border-[rgba(31,42,54,0.1)] bg-white font-mono shadow-sm" placeholder="Paste your reset token" value={resetToken} onChange={(e) => setResetToken(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#1f2a36]/52">New password</Label>
                  <Input type="password" className="h-12 rounded-2xl border-[rgba(31,42,54,0.1)] bg-white shadow-sm" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#1f2a36]/52">Confirm password</Label>
                  <Input type="password" className="h-12 rounded-2xl border-[rgba(31,42,54,0.1)] bg-white shadow-sm" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void handleResetPassword()} />
                </div>
                {error && <StatusCard tone="error" message={error} />}
                {success && <StatusCard tone="success" message={success} />}
                <Button onClick={() => void handleResetPassword()} disabled={loading} className="h-12 w-full rounded-2xl bg-[linear-gradient(135deg,#557df5,#3a5fd9)] text-white shadow-[0_16px_34px_rgba(85,125,245,0.28)]">
                  {loading ? 'Resetting password…' : 'Reset password'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <p className="mt-10 text-center text-xs text-[#1f2a36]/35">
            © 2026 King CRM Hub. Premium CRM infrastructure for insurance operators.
          </p>
        </section>
      </div>
    </main>
  )
}

function StatusCard({ tone, message }: { tone: 'success' | 'error'; message: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-3 text-sm',
        tone === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-red-200 bg-red-50 text-red-700'
      )}
    >
      {message}
    </div>
  )
}
