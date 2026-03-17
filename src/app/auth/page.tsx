"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Shield, Mail, Lock, User, Building2, ArrowRight, Sparkles, Eye, EyeOff } from "lucide-react"

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ email: "", password: "", name: "", orgName: "" })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode === "signin" ? "signin" : "signup",
          email: form.email,
          password: form.password,
          name: form.name || undefined,
          orgName: form.orgName || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || "Something went wrong")
        return
      }
      router.push("/")
      router.refresh()
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#1E293B] via-[#334155] to-[#1E293B] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-[#3B8595] rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#5BA3B3] rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#3B8595] to-[#5BA3B3] flex items-center justify-center">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <span className="text-3xl font-bold text-white tracking-tight">EliteCRM</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
            The AI-powered CRM<br />built for elite brokers
          </h1>
          <p className="text-lg text-slate-300 mb-10 max-w-md">
            Manage leads, automate follow-ups, score prospects with AI, and close more deals — all from one platform.
          </p>
          <div className="space-y-4">
            {[
              "AI lead scoring & carrier playbooks",
              "Pipeline with drag-and-drop Kanban",
              "Social media content automation",
              "CSV import with smart duplicate detection",
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3 text-slate-200">
                <Sparkles className="w-5 h-5 text-[#5BA3B3] shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3B8595] to-[#5BA3B3] flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-[#1E293B]">EliteCRM</span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-2xl font-bold text-[#1E293B] mb-1">
                {mode === "signin" ? "Welcome back" : "Create your account"}
              </h2>
              <p className="text-[#64748B] mb-8">
                {mode === "signin"
                  ? "Sign in to access your CRM dashboard"
                  : "Get started with your own elite CRM workspace"}
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "signup" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-[#334155] mb-1.5">Full name</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                        <input
                          type="text"
                          value={form.name}
                          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#F5F1EA] border border-[#E2DDD4] text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#3B8595] focus:border-transparent transition"
                          placeholder="John Doe"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#334155] mb-1.5">Agency / Company name</label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                        <input
                          type="text"
                          value={form.orgName}
                          onChange={(e) => setForm((f) => ({ ...f, orgName: e.target.value }))}
                          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#F5F1EA] border border-[#E2DDD4] text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#3B8595] focus:border-transparent transition"
                          placeholder="My Insurance Agency"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-[#334155] mb-1.5">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#F5F1EA] border border-[#E2DDD4] text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#3B8595] focus:border-transparent transition"
                      placeholder="you@agency.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#334155] mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-[#F5F1EA] border border-[#E2DDD4] text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#3B8595] focus:border-transparent transition"
                      placeholder={mode === "signup" ? "Min 6 characters" : "••••••••"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#3B8595] transition"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#3B8595] to-[#5BA3B3] text-white font-semibold hover:from-[#2A6A78] hover:to-[#3B8595] transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {mode === "signin" ? "Sign in" : "Create account"}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <span className="text-sm text-[#64748B]">
                  {mode === "signin" ? "Don't have an account?" : "Already have an account?"}
                </span>{" "}
                <button
                  onClick={() => {
                    setMode(mode === "signin" ? "signup" : "signin")
                    setError(null)
                  }}
                  className="text-sm font-medium text-[#3B8595] hover:text-[#2A6A78] transition"
                >
                  {mode === "signin" ? "Sign up" : "Sign in"}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
