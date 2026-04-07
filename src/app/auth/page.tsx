'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getSession, signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Mode = 'login' | 'signup' | 'forgot' | 'reset'

const FEATURES = [
  { icon: '👥', title: 'Lead Management', desc: 'Track, score, and convert leads faster than ever.' },
  { icon: '📊', title: 'Pipeline Analytics', desc: 'Real-time insights on every stage of your sales funnel.' },
  { icon: '⚡', title: 'Automated Sequences', desc: 'Follow-ups that run while you close deals.' },
  { icon: '🏆', title: 'Team Performance', desc: 'Leaderboards, quotas, and coaching built in.' },
]

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Login
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Signup
  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [organizationName, setOrganizationName] = useState('')

  // Forgot
  const [forgotEmail, setForgotEmail] = useState('')
  const [resetTokenDisplay, setResetTokenDisplay] = useState<string | null>(null)

  // Reset
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
      } catch { /* stay on page */ }
    })()
    return () => { cancelled = true }
  }, [router])

  const switchMode = (next: Mode) => {
    setError(null); setSuccess(null); setResetTokenDisplay(null); setMode(next)
  }

  const handleLoginSignup = async () => {
    setLoading(true); setError(null)
    try {
      if (mode === 'signup') {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: signupName, email: signupEmail, password: signupPassword, organizationName }),
        })
        const data = await res.json()
        if (!res.ok || data.error) throw new Error(data.error || 'Signup failed')
      }
      const email = mode === 'login' ? loginEmail : signupEmail
      const password = mode === 'login' ? loginPassword : signupPassword
      const result = await signIn('credentials', { redirect: false, email, password, callbackUrl: '/' })
      if (!result || result.error) throw new Error(mode === 'login' ? 'Invalid email or password.' : 'Authentication failed')
      const session = await getSession()
      router.push(session?.user?.mustChangePassword ? '/auth/password' : '/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally { setLoading(false) }
  }

  const handleForgotPassword = async () => {
    setLoading(true); setError(null); setResetTokenDisplay(null)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Request failed')
      if (data.token) { setResetTokenDisplay(data.token) }
      else { setSuccess('If that email exists, contact your admin for the reset token.') }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally { setLoading(false) }
  }

  const handleResetPassword = async () => {
    setLoading(true); setError(null)
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); setLoading(false); return }
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken.trim(), password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Reset failed')
      setSuccess('Password reset successfully.')
      switchMode('login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed')
    } finally { setLoading(false) }
  }

  return (
    <main className="min-h-screen bg-[#080C14] text-white overflow-hidden relative">

      {/* Background glow effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#2563EB] opacity-10 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-[#14B8A6] opacity-10 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-[#0EA5E9] opacity-5 blur-[160px]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col lg:flex-row">

        {/* LEFT — Hero */}
        <div className="flex flex-1 flex-col justify-center px-8 py-16 lg:px-16 lg:py-24 xl:px-24">
          {/* Logo / Brand */}
          <div className="mb-12">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#14B8A6] flex items-center justify-center shadow-lg shadow-blue-500/30">
                <span className="text-white font-black text-lg">K</span>
              </div>
              <span className="text-white/60 text-sm font-semibold tracking-[0.2em] uppercase">King CRM</span>
            </div>
            <h1 className="text-5xl lg:text-6xl xl:text-7xl font-black leading-[1.05] tracking-tight mb-6">
              <span className="text-white">Close More.</span>
              <br />
              <span className="bg-gradient-to-r from-[#2563EB] via-[#0EA5E9] to-[#14B8A6] bg-clip-text text-transparent">
                Work Less.
              </span>
              <br />
              <span className="text-white">Win Always.</span>
            </h1>
            <p className="text-white/50 text-lg lg:text-xl max-w-lg leading-relaxed">
              The CRM built for insurance pros who are serious about growth. Leads, pipelines, automation — all in one place.
            </p>
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-2 gap-4 max-w-lg">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.04] backdrop-blur-sm p-4 hover:bg-white/[0.08] hover:border-white/10 transition-all duration-200"
              >
                <div className="text-2xl mb-2">{f.icon}</div>
                <div className="text-white font-semibold text-sm mb-1">{f.title}</div>
                <div className="text-white/40 text-xs leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>

          {/* Social proof */}
          <div className="mt-10 flex items-center gap-4">
            <div className="flex -space-x-2">
              {['#2563EB','#0EA5E9','#14B8A6','#06B6D4'].map((c, i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-[#080C14] flex items-center justify-center text-white text-xs font-bold" style={{background: c}}>
                  {['J','M','S','A'][i]}
                </div>
              ))}
            </div>
            <p className="text-white/40 text-sm">
              <span className="text-white/70 font-semibold">Insurance teams</span> trust King CRM to close more deals
            </p>
          </div>
        </div>

        {/* RIGHT — Auth Form */}
        <div className="flex items-center justify-center px-6 py-12 lg:w-[480px] xl:w-[520px] lg:border-l border-white/[0.06]">
          <div className="w-full max-w-sm">

            {/* Form tabs for login/signup */}
            {(mode === 'login' || mode === 'signup') && (
              <>
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-white mb-1">
                    {mode === 'login' ? 'Welcome back' : 'Create your workspace'}
                  </h2>
                  <p className="text-white/40 text-sm">
                    {mode === 'login' ? "Sign in to your King CRM account." : "Get started in under 2 minutes."}
                  </p>
                </div>

                {/* Tab switcher */}
                <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.04] p-1 mb-6">
                  <button
                    onClick={() => switchMode('login')}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
                      mode === 'login'
                        ? 'bg-gradient-to-r from-[#2563EB] to-[#0EA5E9] text-white shadow-lg shadow-blue-500/20'
                        : 'text-white/40 hover:text-white/70'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => switchMode('signup')}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
                      mode === 'signup'
                        ? 'bg-gradient-to-r from-[#2563EB] to-[#0EA5E9] text-white shadow-lg shadow-blue-500/20'
                        : 'text-white/40 hover:text-white/70'
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                <div className="space-y-4">
                  {mode === 'signup' && (
                    <>
                      <div>
                        <Label className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-1.5 block">Your name</Label>
                        <Input
                          className="bg-white/[0.06] border-white/10 text-white placeholder:text-white/20 focus:border-[#2563EB] focus:ring-[#2563EB]/20 h-11 rounded-xl"
                          placeholder="Brady Wilson"
                          value={signupName}
                          onChange={(e) => setSignupName(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-1.5 block">Organization</Label>
                        <Input
                          className="bg-white/[0.06] border-white/10 text-white placeholder:text-white/20 focus:border-[#2563EB] focus:ring-[#2563EB]/20 h-11 rounded-xl"
                          placeholder="Brighter Health Solutions"
                          value={organizationName}
                          onChange={(e) => setOrganizationName(e.target.value)}
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <Label className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-1.5 block">Email</Label>
                    <Input
                      type="email"
                      className="bg-white/[0.06] border-white/10 text-white placeholder:text-white/20 focus:border-[#2563EB] focus:ring-[#2563EB]/20 h-11 rounded-xl"
                      placeholder="you@company.com"
                      value={mode === 'login' ? loginEmail : signupEmail}
                      onChange={(e) => mode === 'login' ? setLoginEmail(e.target.value) : setSignupEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void handleLoginSignup()}
                    />
                  </div>
                  <div>
                    <Label className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-1.5 block">Password</Label>
                    <Input
                      type="password"
                      className="bg-white/[0.06] border-white/10 text-white placeholder:text-white/20 focus:border-[#2563EB] focus:ring-[#2563EB]/20 h-11 rounded-xl"
                      placeholder="••••••••"
                      value={mode === 'login' ? loginPassword : signupPassword}
                      onChange={(e) => mode === 'login' ? setLoginPassword(e.target.value) : setSignupPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void handleLoginSignup()}
                    />
                  </div>

                  {mode === 'login' && (
                    <div className="flex justify-end">
                      <button type="button" onClick={() => switchMode('forgot')} className="text-xs text-[#0EA5E9] hover:text-[#2563EB] transition-colors">
                        Forgot password?
                      </button>
                    </div>
                  )}

                  {error && (
                    <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                      {error}
                    </div>
                  )}

                  <button
                    onClick={() => void handleLoginSignup()}
                    disabled={loading}
                    className="w-full h-11 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#14B8A6] text-white font-semibold text-sm hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
                  >
                    {loading ? 'Working...' : mode === 'login' ? 'Sign In →' : 'Create Workspace →'}
                  </button>

                  <p className="text-center text-xs text-white/30">
                    Have a reset token?{' '}
                    <button type="button" onClick={() => switchMode('reset')} className="text-[#0EA5E9] hover:text-white transition-colors">
                      Reset password
                    </button>
                  </p>
                </div>
              </>
            )}

            {/* FORGOT PASSWORD */}
            {mode === 'forgot' && (
              <>
                <div className="mb-8">
                  <button onClick={() => switchMode('login')} className="text-white/40 hover:text-white text-sm mb-4 flex items-center gap-1 transition-colors">
                    ← Back
                  </button>
                  <h2 className="text-2xl font-bold text-white mb-1">Reset your password</h2>
                  <p className="text-white/40 text-sm">Enter your email to get a reset token.</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-1.5 block">Email address</Label>
                    <Input
                      type="email"
                      className="bg-white/[0.06] border-white/10 text-white placeholder:text-white/20 focus:border-[#2563EB] h-11 rounded-xl"
                      placeholder="you@company.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void handleForgotPassword()}
                    />
                  </div>
                  {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">{error}</div>}
                  {success && <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-400">{success}</div>}
                  {resetTokenDisplay && (
                    <div className="rounded-xl border border-[#2563EB]/30 bg-[#2563EB]/10 p-4 space-y-3">
                      <p className="text-sm font-semibold text-white">Your reset token (expires in 1 hour):</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 break-all rounded-lg bg-white/[0.06] px-3 py-2 text-xs font-mono text-[#0EA5E9]">
                          {resetTokenDisplay}
                        </code>
                        <button
                          onClick={() => void navigator.clipboard.writeText(resetTokenDisplay)}
                          className="shrink-0 px-3 py-2 rounded-lg border border-white/10 text-white/60 hover:text-white text-xs transition-colors"
                        >
                          Copy
                        </button>
                      </div>
                      <button
                        onClick={() => { setResetToken(resetTokenDisplay); switchMode('reset') }}
                        className="w-full h-10 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#14B8A6] text-white font-semibold text-sm hover:opacity-90 transition-all"
                      >
                        Use this token →
                      </button>
                    </div>
                  )}
                  {!resetTokenDisplay && (
                    <button
                      onClick={() => void handleForgotPassword()}
                      disabled={loading}
                      className="w-full h-11 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#14B8A6] text-white font-semibold text-sm hover:opacity-90 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50"
                    >
                      {loading ? 'Working...' : 'Get Reset Token →'}
                    </button>
                  )}
                </div>
              </>
            )}

            {/* RESET PASSWORD */}
            {mode === 'reset' && (
              <>
                <div className="mb-8">
                  <button onClick={() => switchMode('forgot')} className="text-white/40 hover:text-white text-sm mb-4 flex items-center gap-1 transition-colors">
                    ← Back
                  </button>
                  <h2 className="text-2xl font-bold text-white mb-1">Set new password</h2>
                  <p className="text-white/40 text-sm">Enter your reset token and choose a new password.</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-1.5 block">Reset token</Label>
                    <Input
                      className="bg-white/[0.06] border-white/10 text-white font-mono text-sm placeholder:text-white/20 focus:border-[#2563EB] h-11 rounded-xl"
                      placeholder="Paste your reset token"
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-1.5 block">New password</Label>
                    <Input type="password" className="bg-white/[0.06] border-white/10 text-white placeholder:text-white/20 focus:border-[#2563EB] h-11 rounded-xl" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-1.5 block">Confirm password</Label>
                    <Input type="password" className="bg-white/[0.06] border-white/10 text-white placeholder:text-white/20 focus:border-[#2563EB] h-11 rounded-xl" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void handleResetPassword()} />
                  </div>
                  {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">{error}</div>}
                  {success && <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-400">{success}</div>}
                  <button
                    onClick={() => void handleResetPassword()}
                    disabled={loading}
                    className="w-full h-11 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#14B8A6] text-white font-semibold text-sm hover:opacity-90 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50"
                  >
                    {loading ? 'Resetting...' : 'Reset Password →'}
                  </button>
                </div>
              </>
            )}

            {/* Footer */}
            <p className="mt-8 text-center text-xs text-white/20">
              © 2026 King CRM Hub · Built for insurance pros
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
