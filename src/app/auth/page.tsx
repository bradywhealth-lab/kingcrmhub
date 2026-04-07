'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getSession, signIn } from 'next-auth/react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Mode = 'login' | 'signup' | 'forgot' | 'reset'

const FEATURES = [
  { icon: '👥', title: 'Lead Management', desc: 'Capture, score, and convert leads without lifting a finger.' },
  { icon: '📊', title: 'Pipeline Analytics', desc: 'Real-time visibility on every deal, every stage.' },
  { icon: '⚡', title: 'Automated Sequences', desc: 'Follow-ups that run while you close.' },
  { icon: '🏆', title: 'Team Performance', desc: 'Leaderboards, quotas, and coaching built in.' },
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
      } catch { /* stay */ }
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
      if (data.token) setResetTokenDisplay(data.token)
      else setSuccess('If that email exists, contact your admin for the reset token.')
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
    <main className="min-h-screen overflow-hidden" style={{ background: '#fafaf8' }}>

      {/* Top nav bar */}
      <nav className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-sm shadow-md" style={{ background: 'linear-gradient(135deg, #557df5, #3a5fd9)' }}>K</div>
          <span className="font-bold text-sm tracking-wide" style={{ color: '#1f2a36' }}>KING CRM HUB</span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm font-medium" style={{ color: '#1f2a36', opacity: 0.5 }}>
          <span>Features</span>
          <span>Pricing</span>
          <span>Support</span>
        </div>
      </nav>

      <div className="flex min-h-screen flex-col lg:flex-row">

        {/* LEFT — Hero */}
        <div className="flex flex-1 flex-col justify-center px-8 pt-24 pb-16 lg:px-16 lg:py-0 xl:px-24 relative">

          {/* Decorative soft blob */}
          <div className="pointer-events-none absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-40" style={{ background: 'radial-gradient(circle, #557df520 0%, transparent 70%)' }} />

          <div className="max-w-xl relative">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-8 text-xs font-semibold border" style={{ background: '#fcf8ec', borderColor: '#557df530', color: '#557df5' }}>
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#557df5' }} />
              Built for Insurance Professionals
            </div>

            <h1 className="font-black leading-[1.08] tracking-tight mb-6" style={{ fontSize: 'clamp(2.6rem, 5vw, 4.5rem)', color: '#1f2a36' }}>
              Close More.<br />
              <span style={{ color: '#557df5' }}>Work Smarter.</span><br />
              Win Every Time.
            </h1>

            <p className="text-lg mb-10 leading-relaxed max-w-md" style={{ color: '#1f2a36', opacity: 0.55 }}>
              The CRM that moves as fast as you do. Leads, pipelines, automation, and team performance — all in one place, built for the way you actually sell.
            </p>

            {/* Feature grid */}
            <div className="grid grid-cols-2 gap-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-2xl p-4 border transition-all duration-200 hover:shadow-md" style={{ background: '#fcfcfc', borderColor: '#1f2a3610' }}>
                  <div className="text-xl mb-2">{f.icon}</div>
                  <div className="font-semibold text-sm mb-1" style={{ color: '#1f2a36' }}>{f.title}</div>
                  <div className="text-xs leading-relaxed" style={{ color: '#1f2a36', opacity: 0.45 }}>{f.desc}</div>
                </div>
              ))}
            </div>

            {/* Social proof */}
            <div className="mt-8 flex items-center gap-3">
              <div className="flex -space-x-2">
                {['#557df5','#3a5fd9','#6b91f7','#4a6ee0'].map((c, i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-white text-xs font-bold" style={{ background: c, borderColor: '#fafaf8' }}>
                    {['J','M','S','R'][i]}
                  </div>
                ))}
              </div>
              <p className="text-sm" style={{ color: '#1f2a36', opacity: 0.45 }}>
                <span style={{ opacity: 1, fontWeight: 600 }}>Trusted by insurance teams</span> across the country
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT — Auth Form */}
        <div className="flex items-center justify-center px-6 py-12 lg:py-0 lg:w-[460px] xl:w-[500px] border-t lg:border-t-0 lg:border-l" style={{ borderColor: '#1f2a3608' }}>
          <div className="w-full max-w-sm">

            {/* LOGIN / SIGNUP */}
            {(mode === 'login' || mode === 'signup') && (
              <>
                <div className="mb-7">
                  <h2 className="text-2xl font-bold mb-1" style={{ color: '#1f2a36' }}>
                    {mode === 'login' ? 'Welcome back' : 'Create your workspace'}
                  </h2>
                  <p className="text-sm" style={{ color: '#1f2a36', opacity: 0.45 }}>
                    {mode === 'login' ? 'Sign in to your King CRM account.' : 'Get started in under 2 minutes.'}
                  </p>
                </div>

                {/* Tab switcher */}
                <div className="flex rounded-xl border p-1 mb-6" style={{ background: '#fcfcfc', borderColor: '#1f2a3612' }}>
                  {(['login','signup'] as Mode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => switchMode(m)}
                      className="flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-150"
                      style={mode === m ? { background: '#557df5', color: '#fcfcfc', boxShadow: '0 2px 8px #557df530' } : { color: '#1f2a36', opacity: 0.4 }}
                    >
                      {m === 'login' ? 'Sign In' : 'Create Account'}
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  {mode === 'signup' && (
                    <>
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: '#1f2a36', opacity: 0.5 }}>Your name</Label>
                        <Input className="h-11 rounded-xl border text-sm" style={{ background: '#fcfcfc', borderColor: '#1f2a3615', color: '#1f2a36' }} placeholder="Brady Wilson" value={signupName} onChange={(e) => setSignupName(e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: '#1f2a36', opacity: 0.5 }}>Organization</Label>
                        <Input className="h-11 rounded-xl border text-sm" style={{ background: '#fcfcfc', borderColor: '#1f2a3615', color: '#1f2a36' }} placeholder="Brighter Health Solutions" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} />
                      </div>
                    </>
                  )}
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: '#1f2a36', opacity: 0.5 }}>Email</Label>
                    <Input type="email" className="h-11 rounded-xl border text-sm" style={{ background: '#fcfcfc', borderColor: '#1f2a3615', color: '#1f2a36' }} placeholder="you@company.com" value={mode === 'login' ? loginEmail : signupEmail} onChange={(e) => mode === 'login' ? setLoginEmail(e.target.value) : setSignupEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void handleLoginSignup()} />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: '#1f2a36', opacity: 0.5 }}>Password</Label>
                    <Input type="password" className="h-11 rounded-xl border text-sm" style={{ background: '#fcfcfc', borderColor: '#1f2a3615', color: '#1f2a36' }} placeholder="••••••••" value={mode === 'login' ? loginPassword : signupPassword} onChange={(e) => mode === 'login' ? setLoginPassword(e.target.value) : setSignupPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void handleLoginSignup()} />
                  </div>

                  {mode === 'login' && (
                    <div className="flex justify-end">
                      <button type="button" onClick={() => switchMode('forgot')} className="text-xs font-medium hover:opacity-80 transition-opacity" style={{ color: '#557df5' }}>
                        Forgot password?
                      </button>
                    </div>
                  )}

                  {error && <div className="rounded-xl px-4 py-3 text-sm border" style={{ background: '#fff0f0', borderColor: '#fca5a520', color: '#dc2626' }}>{error}</div>}

                  <button
                    onClick={() => void handleLoginSignup()}
                    disabled={loading}
                    className="w-full h-11 rounded-xl font-semibold text-sm transition-all duration-150 hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg, #557df5, #3a5fd9)', color: '#fcfcfc', boxShadow: '0 4px 14px #557df530' }}
                  >
                    {loading ? 'Working...' : mode === 'login' ? 'Sign In →' : 'Create Workspace →'}
                  </button>

                  <p className="text-center text-xs" style={{ color: '#1f2a36', opacity: 0.35 }}>
                    Have a reset token?{' '}
                    <button type="button" onClick={() => switchMode('reset')} className="font-medium hover:opacity-80 transition-opacity" style={{ color: '#557df5', opacity: 1 }}>
                      Reset password
                    </button>
                  </p>
                </div>
              </>
            )}

            {/* FORGOT PASSWORD */}
            {mode === 'forgot' && (
              <>
                <button onClick={() => switchMode('login')} className="text-sm mb-6 flex items-center gap-1 font-medium hover:opacity-70 transition-opacity" style={{ color: '#1f2a36', opacity: 0.5 }}>← Back</button>
                <div className="mb-7">
                  <h2 className="text-2xl font-bold mb-1" style={{ color: '#1f2a36' }}>Reset password</h2>
                  <p className="text-sm" style={{ color: '#1f2a36', opacity: 0.45 }}>Enter your email to get a reset token.</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: '#1f2a36', opacity: 0.5 }}>Email address</Label>
                    <Input type="email" className="h-11 rounded-xl border text-sm" style={{ background: '#fcfcfc', borderColor: '#1f2a3615', color: '#1f2a36' }} placeholder="you@company.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void handleForgotPassword()} />
                  </div>
                  {error && <div className="rounded-xl px-4 py-3 text-sm border" style={{ background: '#fff0f0', borderColor: '#fca5a520', color: '#dc2626' }}>{error}</div>}
                  {success && <div className="rounded-xl px-4 py-3 text-sm border" style={{ background: '#f0fdf4', borderColor: '#86efac30', color: '#16a34a' }}>{success}</div>}
                  {resetTokenDisplay && (
                    <div className="rounded-xl border p-4 space-y-3" style={{ background: '#fcf8ec', borderColor: '#557df520' }}>
                      <p className="text-sm font-semibold" style={{ color: '#1f2a36' }}>Your reset token (expires in 1 hour):</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 break-all rounded-lg px-3 py-2 text-xs font-mono" style={{ background: '#fcfcfc', color: '#557df5', border: '1px solid #557df520' }}>{resetTokenDisplay}</code>
                        <button onClick={() => void navigator.clipboard.writeText(resetTokenDisplay)} className="shrink-0 px-3 py-2 rounded-lg border text-xs font-medium transition-colors hover:opacity-80" style={{ borderColor: '#1f2a3615', color: '#1f2a36' }}>Copy</button>
                      </div>
                      <button onClick={() => { setResetToken(resetTokenDisplay); switchMode('reset') }} className="w-full h-10 rounded-xl font-semibold text-sm transition-all hover:opacity-90" style={{ background: 'linear-gradient(135deg, #557df5, #3a5fd9)', color: '#fcfcfc' }}>
                        Use this token →
                      </button>
                    </div>
                  )}
                  {!resetTokenDisplay && (
                    <button onClick={() => void handleForgotPassword()} disabled={loading} className="w-full h-11 rounded-xl font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #557df5, #3a5fd9)', color: '#fcfcfc', boxShadow: '0 4px 14px #557df530' }}>
                      {loading ? 'Working...' : 'Get Reset Token →'}
                    </button>
                  )}
                </div>
              </>
            )}

            {/* RESET PASSWORD */}
            {mode === 'reset' && (
              <>
                <button onClick={() => switchMode('forgot')} className="text-sm mb-6 flex items-center gap-1 font-medium hover:opacity-70 transition-opacity" style={{ color: '#1f2a36', opacity: 0.5 }}>← Back</button>
                <div className="mb-7">
                  <h2 className="text-2xl font-bold mb-1" style={{ color: '#1f2a36' }}>Set new password</h2>
                  <p className="text-sm" style={{ color: '#1f2a36', opacity: 0.45 }}>Enter your reset token and choose a new password.</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: '#1f2a36', opacity: 0.5 }}>Reset token</Label>
                    <Input className="h-11 rounded-xl border text-sm font-mono" style={{ background: '#fcfcfc', borderColor: '#1f2a3615', color: '#1f2a36' }} placeholder="Paste your reset token" value={resetToken} onChange={(e) => setResetToken(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: '#1f2a36', opacity: 0.5 }}>New password</Label>
                    <Input type="password" className="h-11 rounded-xl border text-sm" style={{ background: '#fcfcfc', borderColor: '#1f2a3615', color: '#1f2a36' }} placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: '#1f2a36', opacity: 0.5 }}>Confirm password</Label>
                    <Input type="password" className="h-11 rounded-xl border text-sm" style={{ background: '#fcfcfc', borderColor: '#1f2a3615', color: '#1f2a36' }} placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void handleResetPassword()} />
                  </div>
                  {error && <div className="rounded-xl px-4 py-3 text-sm border" style={{ background: '#fff0f0', borderColor: '#fca5a520', color: '#dc2626' }}>{error}</div>}
                  {success && <div className="rounded-xl px-4 py-3 text-sm border" style={{ background: '#f0fdf4', borderColor: '#86efac30', color: '#16a34a' }}>{success}</div>}
                  <button onClick={() => void handleResetPassword()} disabled={loading} className="w-full h-11 rounded-xl font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #557df5, #3a5fd9)', color: '#fcfcfc', boxShadow: '0 4px 14px #557df530' }}>
                    {loading ? 'Resetting...' : 'Reset Password →'}
                  </button>
                </div>
              </>
            )}

            <p className="mt-8 text-center text-xs" style={{ color: '#1f2a36', opacity: 0.25 }}>
              © 2026 King CRM Hub · Built for insurance professionals
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
