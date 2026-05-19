"use client"

import { useCallback, useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowRight,
  Bot,
  Building2,
  Check,
  ChevronRight,
  FileText,
  Sparkles,
  UserPlus,
  X,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { toast } from "@/hooks/use-toast"

// ============================================
// TYPES
// ============================================

interface OnboardingWizardProps {
  organizationName: string
  userName: string | null
  initialStep?: number
  onComplete: () => void
  onSkip: () => void
}

type StepStatus = "pending" | "active" | "done" | "skipped"

interface StepDef {
  id: string
  title: string
  subtitle: string
  icon: React.ElementType
  color: string
  optional?: boolean
}

const STEPS: StepDef[] = [
  {
    id: "welcome",
    title: "Welcome to KingCRMHub",
    subtitle: "Let's get your workspace ready in under 3 minutes.",
    icon: Sparkles,
    color: "#557df5",
  },
  {
    id: "organization",
    title: "Set up your organization",
    subtitle: "Confirm your organization details so everything looks right.",
    icon: Building2,
    color: "#3a5fd9",
  },
  {
    id: "carrier",
    title: "Add your first carrier",
    subtitle: "Add a carrier to your library so the AI can match leads to plans.",
    icon: FileText,
    color: "#2563eb",
  },
  {
    id: "lead",
    title: "Add your first lead",
    subtitle: "Drop in a contact to see how the CRM works end-to-end.",
    icon: UserPlus,
    color: "#0284c7",
    optional: true,
  },
  {
    id: "automation",
    title: "Enable a quick automation",
    subtitle: "Set a follow-up rule that fires when a new lead lands.",
    icon: Zap,
    color: "#0ea5e9",
    optional: true,
  },
  {
    id: "ai-setup",
    title: "Set Up Your AI Assistant",
    subtitle: "Connect an AI provider for sales coaching, scripts, and lead qualification.",
    icon: Bot,
    color: "#7c3aed",
    optional: true,
  },
  {
    id: "done",
    title: "You're all set",
    subtitle: "Your workspace is ready. Time to close deals.",
    icon: Bot,
    color: "#16a34a",
  },
]

// ============================================
// STEP INDICATOR
// ============================================

function StepIndicator({
  steps,
  currentIndex,
  statuses,
}: {
  steps: StepDef[]
  currentIndex: number
  statuses: StepStatus[]
}) {
  const visibleSteps = steps.slice(0, -1) // exclude "done" step from indicator
  return (
    <div className="flex items-center gap-0">
      {visibleSteps.map((step, index) => {
        const status = statuses[index] ?? "pending"
        const isLast = index === visibleSteps.length - 1
        return (
          <div key={step.id} className="flex items-center">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all duration-300",
                status === "done" && "border-[#16a34a] bg-[#16a34a] text-white",
                status === "active" && "border-[#557df5] bg-[#557df5] text-white shadow-[0_0_12px_rgba(85,125,245,0.5)]",
                status === "skipped" && "border-amber-400 bg-amber-50 text-amber-600",
                status === "pending" && "border-[rgba(31,42,54,0.15)] bg-white text-[rgba(31,42,54,0.35)]"
              )}
            >
              {status === "done" ? (
                <Check className="h-4 w-4" />
              ) : (
                <span>{index + 1}</span>
              )}
            </div>
            {!isLast && (
              <div
                className={cn(
                  "h-0.5 w-8 transition-all duration-500",
                  index < currentIndex ? "bg-[#557df5]" : "bg-[rgba(31,42,54,0.1)]"
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ============================================
// STEP CONTENT PANELS
// ============================================

function WelcomeStep({
  organizationName,
  userName,
  onNext,
}: {
  organizationName: string
  userName: string | null
  onNext: () => void
}) {
  return (
    <div className="space-y-8 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
        className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-[linear-gradient(135deg,#557df5,#3a5fd9)] shadow-[0_20px_40px_rgba(85,125,245,0.35)]"
      >
        <Sparkles className="h-9 w-9 text-white" />
      </motion.div>

      <div className="space-y-3">
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-3xl font-semibold tracking-[-0.03em] text-[#1f2a36]"
        >
          Welcome{userName ? `, ${userName.split(" ")[0]}` : ""}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-lg text-[#1f2a36]/60"
        >
          <span className="font-semibold text-[#557df5]">{organizationName}</span> is ready for setup.
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mx-auto max-w-md text-sm leading-7 text-[#1f2a36]/55"
        >
          We'll walk you through 3–5 quick steps to get your pipeline, carrier library, and automations running.
          Takes less than 3 minutes.
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mx-auto grid max-w-sm grid-cols-3 gap-3"
      >
        {[
          { label: "AI Scoring", desc: "Auto-scored leads" },
          { label: "Carrier AI", desc: "Smart plan matching" },
          { label: "Pipeline", desc: "Drag & drop deals" },
        ].map((feature) => (
          <div
            key={feature.label}
            className="rounded-2xl border border-[rgba(31,42,54,0.08)] bg-[#f8f5ec] p-3 text-center"
          >
            <p className="text-xs font-semibold text-[#1f2a36]">{feature.label}</p>
            <p className="mt-0.5 text-[11px] text-[#1f2a36]/50">{feature.desc}</p>
          </div>
        ))}
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
        <Button
          onClick={onNext}
          className="h-12 rounded-2xl bg-[linear-gradient(135deg,#557df5,#3a5fd9)] px-8 text-white shadow-[0_12px_28px_rgba(85,125,245,0.28)] hover:opacity-95"
        >
          Get started
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </motion.div>
    </div>
  )
}

function OrganizationStep({
  initialName,
  onNext,
  onSkip,
}: {
  initialName: string
  onNext: () => void
  onSkip: () => void
}) {
  const [name, setName] = useState(initialName)
  const [logo, setLogo] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Name required", description: "Enter your organization name.", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/settings/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), logo: logo.trim() || undefined }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: "Organization updated", description: "Your workspace name has been saved." })
      onNext()
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#1f2a36]/52">
            Organization name
          </Label>
          <Input
            className="h-12 rounded-2xl border-[rgba(31,42,54,0.1)] bg-white shadow-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="King Insurance Group"
          />
        </div>
        <div>
          <Label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#1f2a36]/52">
            Logo URL{" "}
            <span className="text-[rgba(31,42,54,0.38)] normal-case font-normal tracking-normal">(optional)</span>
          </Label>
          <Input
            className="h-12 rounded-2xl border-[rgba(31,42,54,0.1)] bg-white shadow-sm"
            value={logo}
            onChange={(e) => setLogo(e.target.value)}
            placeholder="https://your-domain.com/logo.png"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          className="h-11 rounded-2xl border-[rgba(31,42,54,0.1)] text-[#1f2a36]/60"
          onClick={onSkip}
        >
          Skip for now
        </Button>
        <Button
          onClick={() => void handleSave()}
          disabled={saving}
          className="h-11 flex-1 rounded-2xl bg-[linear-gradient(135deg,#557df5,#3a5fd9)] text-white shadow-[0_8px_20px_rgba(85,125,245,0.22)] hover:opacity-95"
        >
          {saving ? "Saving…" : "Save & continue"}
          <ChevronRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function CarrierStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [name, setName] = useState("")
  const [website, setWebsite] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Carrier name required", description: "Enter the carrier's name.", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/carriers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          website: website.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: "Carrier added", description: `${name} is now in your carrier library.` })
      onNext()
    } catch (error) {
      toast({
        title: "Failed to add carrier",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#1f2a36]/52">
            Carrier name
          </Label>
          <Input
            className="h-12 rounded-2xl border-[rgba(31,42,54,0.1)] bg-white shadow-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Nationwide, Mutual of Omaha"
          />
        </div>
        <div>
          <Label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#1f2a36]/52">
            Website{" "}
            <span className="normal-case font-normal tracking-normal text-[rgba(31,42,54,0.38)]">(optional)</span>
          </Label>
          <Input
            className="h-12 rounded-2xl border-[rgba(31,42,54,0.1)] bg-white shadow-sm"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://carrier.com"
          />
        </div>
        <div>
          <Label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#1f2a36]/52">
            Notes{" "}
            <span className="normal-case font-normal tracking-normal text-[rgba(31,42,54,0.38)]">(optional)</span>
          </Label>
          <Input
            className="h-12 rounded-2xl border-[rgba(31,42,54,0.1)] bg-white shadow-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Specializes in term life, great for seniors…"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-[rgba(85,125,245,0.18)] bg-[#f5f8ff] p-4 text-sm text-[#1f2a36]/65">
        You can add more carriers and upload underwriting documents in{" "}
        <span className="font-semibold text-[#557df5]">Settings → Carriers</span> at any time.
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          className="h-11 rounded-2xl border-[rgba(31,42,54,0.1)] text-[#1f2a36]/60"
          onClick={onSkip}
        >
          Skip for now
        </Button>
        <Button
          onClick={() => void handleSave()}
          disabled={saving}
          className="h-11 flex-1 rounded-2xl bg-[linear-gradient(135deg,#557df5,#3a5fd9)] text-white shadow-[0_8px_20px_rgba(85,125,245,0.22)] hover:opacity-95"
        >
          {saving ? "Adding carrier…" : "Add carrier & continue"}
          <ChevronRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function LeadStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!firstName.trim() && !lastName.trim()) {
      toast({ title: "Name required", description: "Enter at least a first or last name.", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          source: "manual",
          status: "new",
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: "Lead added", description: "Your first lead is in the system." })
      onNext()
    } catch (error) {
      toast({
        title: "Failed to add lead",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#1f2a36]/52">
            First name
          </Label>
          <Input
            className="h-12 rounded-2xl border-[rgba(31,42,54,0.1)] bg-white shadow-sm"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Jane"
          />
        </div>
        <div>
          <Label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#1f2a36]/52">
            Last name
          </Label>
          <Input
            className="h-12 rounded-2xl border-[rgba(31,42,54,0.1)] bg-white shadow-sm"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Smith"
          />
        </div>
        <div>
          <Label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#1f2a36]/52">
            Email{" "}
            <span className="normal-case font-normal tracking-normal text-[rgba(31,42,54,0.38)]">(optional)</span>
          </Label>
          <Input
            type="email"
            className="h-12 rounded-2xl border-[rgba(31,42,54,0.1)] bg-white shadow-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@email.com"
          />
        </div>
        <div>
          <Label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#1f2a36]/52">
            Phone{" "}
            <span className="normal-case font-normal tracking-normal text-[rgba(31,42,54,0.38)]">(optional)</span>
          </Label>
          <Input
            className="h-12 rounded-2xl border-[rgba(31,42,54,0.1)] bg-white shadow-sm"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 123-4567"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          className="h-11 rounded-2xl border-[rgba(31,42,54,0.1)] text-[#1f2a36]/60"
          onClick={onSkip}
        >
          Skip for now
        </Button>
        <Button
          onClick={() => void handleSave()}
          disabled={saving}
          className="h-11 flex-1 rounded-2xl bg-[linear-gradient(135deg,#557df5,#3a5fd9)] text-white shadow-[0_8px_20px_rgba(85,125,245,0.22)] hover:opacity-95"
        >
          {saving ? "Adding lead…" : "Add lead & continue"}
          <ChevronRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function AutomationStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [saving, setSaving] = useState(false)

  const handleEnable = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New lead — immediate follow-up",
          description: "Automatically flags new leads for a 5-minute follow-up reminder.",
          trigger: "lead_created",
          triggerConfig: { source: "crm" },
          conditions: {},
          actions: [{ type: "create_task", target: "Follow up within 5 minutes" }],
          isActive: true,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: "Automation enabled", description: "Follow-up reminder is now active for new leads." })
      onNext()
    } catch (error) {
      toast({
        title: "Automation failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[rgba(31,42,54,0.08)] bg-[#f8f5ec] p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#557df5]/12">
            <Zap className="h-5 w-5 text-[#557df5]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#1f2a36]">New lead — immediate follow-up</p>
            <p className="mt-1 text-sm text-[#1f2a36]/60">
              When a new lead is created, automatically create a task: "Follow up within 5 minutes".
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-[rgba(85,125,245,0.25)] bg-[rgba(85,125,245,0.08)] px-3 py-1 text-xs text-[#557df5]">
                Trigger: Lead created
              </span>
              <span className="rounded-full border border-[rgba(85,125,245,0.25)] bg-[rgba(85,125,245,0.08)] px-3 py-1 text-xs text-[#557df5]">
                Action: Create task
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-sm text-[#1f2a36]/55">
        You can customize triggers and actions in the{" "}
        <span className="font-semibold text-[#557df5]">AI Automation</span> section at any time.
      </p>

      <div className="flex gap-3">
        <Button
          variant="outline"
          className="h-11 rounded-2xl border-[rgba(31,42,54,0.1)] text-[#1f2a36]/60"
          onClick={onSkip}
        >
          Skip for now
        </Button>
        <Button
          onClick={() => void handleEnable()}
          disabled={saving}
          className="h-11 flex-1 rounded-2xl bg-[linear-gradient(135deg,#557df5,#3a5fd9)] text-white shadow-[0_8px_20px_rgba(85,125,245,0.22)] hover:opacity-95"
        >
          {saving ? "Enabling…" : "Enable automation & finish"}
          <ChevronRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function AiSetupStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [provider, setProvider] = useState<"groq" | "openai" | "anthropic">("groq")
  const [apiKey, setApiKey] = useState("")
  const [saving, setSaving] = useState(false)

  const providers = [
    {
      id: "groq" as const,
      name: "Groq",
      badge: "Free",
      desc: "Free API. Get a key at console.groq.com in 60 seconds.",
      model: "Llama 3.3 70B",
    },
    {
      id: "openai" as const,
      name: "OpenAI",
      badge: "GPT-4o",
      desc: "Requires an OpenAI API key from platform.openai.com.",
      model: "GPT-4o",
    },
    {
      id: "anthropic" as const,
      name: "Anthropic",
      badge: "Claude",
      desc: "Requires an Anthropic API key from console.anthropic.com.",
      model: "Claude Sonnet",
    },
  ]

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast({ title: "API key required", description: "Paste your API key to connect the AI assistant.", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/settings/ai", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiProvider: provider, aiApiKey: apiKey.trim() }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: "AI assistant connected", description: `${data.providerLabel} is now powering your AI assistant.` })
      onNext()
    } catch (error) {
      toast({
        title: "Failed to save",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[rgba(124,58,237,0.18)] bg-[#f8f5ff] px-4 py-3 text-sm text-[#4c1d95]">
        <span className="font-semibold">Groq is 100% free</span> — sign up at{" "}
        <span className="font-semibold">console.groq.com</span>, create an API key, paste it below. No credit card needed.
      </div>

      <div className="grid gap-2">
        {providers.map((p) => (
          <button
            key={p.id}
            onClick={() => setProvider(p.id)}
            className={cn(
              "flex w-full items-start gap-4 rounded-2xl border px-4 py-3.5 text-left transition-all",
              provider === p.id
                ? "border-[#7c3aed] bg-[#f5f0ff] shadow-[0_0_0_1px_#7c3aed]"
                : "border-[rgba(31,42,54,0.1)] bg-white hover:border-[rgba(124,58,237,0.3)]"
            )}
          >
            <div className={cn(
              "mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 transition-all",
              provider === p.id ? "border-[#7c3aed] bg-[#7c3aed]" : "border-[rgba(31,42,54,0.25)]"
            )} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[#1f2a36]">{p.name}</span>
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  p.id === "groq"
                    ? "bg-[#dcfce7] text-[#15803d]"
                    : "bg-[rgba(31,42,54,0.07)] text-[#1f2a36]/60"
                )}>
                  {p.badge}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[#1f2a36]/55">{p.desc}</p>
            </div>
          </button>
        ))}
      </div>

      <div>
        <Label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#1f2a36]/52">
          API Key
        </Label>
        <Input
          className="h-12 rounded-2xl border-[rgba(31,42,54,0.1)] bg-white font-mono text-sm shadow-sm"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={
            provider === "groq"
              ? "gsk_…"
              : provider === "openai"
              ? "sk-…"
              : "sk-ant-…"
          }
          type="password"
          autoComplete="off"
        />
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          className="h-11 rounded-2xl border-[rgba(31,42,54,0.1)] text-[#1f2a36]/60"
          onClick={onSkip}
        >
          Skip for now
        </Button>
        <Button
          onClick={() => void handleSave()}
          disabled={saving}
          className="h-11 flex-1 rounded-2xl bg-[linear-gradient(135deg,#7c3aed,#6d28d9)] text-white shadow-[0_8px_20px_rgba(124,58,237,0.22)] hover:opacity-95"
        >
          {saving ? "Connecting…" : "Connect AI & continue"}
          <ChevronRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function DoneStep({
  skippedCount,
  onFinish,
}: {
  skippedCount: number
  onFinish: () => void
}) {
  return (
    <div className="space-y-8 text-center">
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 180, delay: 0.05 }}
        className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-[linear-gradient(135deg,#16a34a,#15803d)] shadow-[0_20px_40px_rgba(22,163,74,0.3)]"
      >
        <Check className="h-9 w-9 text-white" />
      </motion.div>

      <div className="space-y-2">
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-3xl font-semibold tracking-[-0.03em] text-[#1f2a36]"
        >
          You're all set
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="text-lg text-[#1f2a36]/60"
        >
          Your KingCRMHub workspace is ready to run.
        </motion.p>
        {skippedCount > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="text-sm text-amber-600"
          >
            You skipped {skippedCount} step{skippedCount === 1 ? "" : "s"}. You can complete them anytime from
            Settings.
          </motion.p>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mx-auto grid max-w-sm grid-cols-1 gap-2 text-left"
      >
        {[
          "Dashboard shows live stats and AI insights",
          "Leads tab has your full contact table + AI scoring",
          "Pipeline is your drag-and-drop kanban board",
          "Settings → Carriers to upload documents for AI",
          "Settings → AI Configuration to change your AI provider",
        ].map((item) => (
          <div key={item} className="flex items-center gap-3 text-sm text-[#1f2a36]/65">
            <Check className="h-4 w-4 shrink-0 text-[#16a34a]" />
            {item}
          </div>
        ))}
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        <Button
          onClick={onFinish}
          className="h-12 rounded-2xl bg-[linear-gradient(135deg,#16a34a,#15803d)] px-8 text-white shadow-[0_12px_28px_rgba(22,163,74,0.25)] hover:opacity-95"
        >
          Go to dashboard
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </motion.div>
    </div>
  )
}

// ============================================
// MAIN WIZARD
// ============================================

export function OnboardingWizard({ organizationName, userName, initialStep = 0, onComplete, onSkip }: OnboardingWizardProps) {
  const safeInitial = Math.max(0, Math.min(initialStep, STEPS.length - 1))
  const [currentStep, setCurrentStep] = useState(safeInitial)
  const [statuses, setStatuses] = useState<StepStatus[]>(
    STEPS.map((_, i) => {
      if (i < safeInitial) return "done"
      if (i === safeInitial) return "active"
      return "pending"
    })
  )
  const [skippedCount, setSkippedCount] = useState(0)

  const totalSteps = STEPS.length
  const isDoneStep = currentStep === totalSteps - 1
  const progressPercent = isDoneStep ? 100 : Math.round((currentStep / (totalSteps - 2)) * 100)

  const markStepDone = useCallback(
    (stepIndex: number, wasSkipped = false) => {
      setStatuses((prev) => {
        const next = [...prev]
        next[stepIndex] = wasSkipped ? "skipped" : "done"
        if (stepIndex + 1 < next.length) next[stepIndex + 1] = "active"
        return next
      })
      if (wasSkipped) setSkippedCount((c) => c + 1)
    },
    []
  )

  const advance = useCallback(
    async (wasSkipped = false) => {
      markStepDone(currentStep, wasSkipped)

      const nextStep = currentStep + 1
      setCurrentStep(nextStep)

      // Persist progress to DB
      try {
        await fetch("/api/onboarding", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            step: nextStep,
            ...(nextStep === totalSteps - 1 ? { completed: true } : {}),
          }),
        })
      } catch {
        // Non-fatal
      }
    },
    [currentStep, markStepDone, totalSteps]
  )

  const handleSkipAll = async () => {
    try {
      await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true, step: totalSteps - 1 }),
      })
    } catch {
      // Non-fatal
    }
    onSkip()
  }

  const handleComplete = async () => {
    try {
      await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true, step: totalSteps - 1 }),
      })
    } catch {
      // Non-fatal
    }
    onComplete()
  }

  const step = STEPS[currentStep]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.55)] backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="relative mx-4 w-full max-w-xl overflow-hidden rounded-[28px] border border-white/60 bg-[rgba(252,252,252,0.97)] shadow-[0_40px_100px_rgba(31,42,54,0.22)] backdrop-blur-xl"
      >
        {/* Skip all button */}
        {!isDoneStep && (
          <button
            onClick={() => void handleSkipAll()}
            className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-[#1f2a36]/35 transition-colors hover:bg-[rgba(31,42,54,0.06)] hover:text-[#1f2a36]"
            aria-label="Skip setup"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Header - progress */}
        {!isDoneStep && currentStep > 0 && (
          <div className="border-b border-[rgba(31,42,54,0.06)] px-8 py-5">
            <div className="flex items-center justify-between gap-6">
              <StepIndicator steps={STEPS} currentIndex={currentStep} statuses={statuses} />
              <div className="min-w-[80px] text-right">
                <p className="text-xs font-medium text-[#1f2a36]/45">
                  Step {currentStep} of {totalSteps - 2}
                </p>
              </div>
            </div>
            <Progress value={progressPercent} className="mt-3 h-1.5 bg-[rgba(31,42,54,0.08)]" />
          </div>
        )}

        {/* Step header (for non-welcome, non-done steps) */}
        {currentStep > 0 && !isDoneStep && (
          <div className="px-8 pt-6">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-2xl"
                style={{ backgroundColor: `${step.color}18` }}
              >
                <step.icon className="h-5 w-5" style={{ color: step.color }} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#1f2a36]">{step.title}</h3>
                <p className="text-sm text-[#1f2a36]/55">{step.subtitle}</p>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className={cn("px-8 pb-8", currentStep > 0 && !isDoneStep ? "pt-6" : "pt-8")}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {currentStep === 0 && (
                <WelcomeStep
                  organizationName={organizationName}
                  userName={userName}
                  onNext={() => void advance(false)}
                />
              )}
              {currentStep === 1 && (
                <OrganizationStep
                  initialName={organizationName}
                  onNext={() => void advance(false)}
                  onSkip={() => void advance(true)}
                />
              )}
              {currentStep === 2 && (
                <CarrierStep
                  onNext={() => void advance(false)}
                  onSkip={() => void advance(true)}
                />
              )}
              {currentStep === 3 && (
                <LeadStep
                  onNext={() => void advance(false)}
                  onSkip={() => void advance(true)}
                />
              )}
              {currentStep === 4 && (
                <AutomationStep
                  onNext={() => void advance(false)}
                  onSkip={() => void advance(true)}
                />
              )}
              {currentStep === 5 && !isDoneStep && (
                <AiSetupStep
                  onNext={() => void advance(false)}
                  onSkip={() => void advance(true)}
                />
              )}
              {isDoneStep && (
                <DoneStep
                  skippedCount={skippedCount}
                  onFinish={() => void handleComplete()}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}

// ============================================
// INCOMPLETE SETUP BANNER
// ============================================

export function IncompleteSetupBanner({ onOpenWizard }: { onOpenWizard: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-6 mt-4 flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100">
          <Sparkles className="h-4 w-4 text-amber-600" />
        </div>
        <p className="text-sm font-medium text-amber-800">
          Your workspace setup isn't complete yet.{" "}
          <span className="text-amber-700">Finish setup to unlock the full CRM.</span>
        </p>
      </div>
      <Button
        size="sm"
        onClick={onOpenWizard}
        className="shrink-0 rounded-xl bg-amber-500 text-white hover:bg-amber-600"
      >
        Complete setup
      </Button>
    </motion.div>
  )
}

// ============================================
// HOOK: useOnboarding
// ============================================

export function useOnboarding(isAuthenticated: boolean) {
  const [showWizard, setShowWizard] = useState(false)
  const [showBanner, setShowBanner] = useState(false)
  const [onboardingLoaded, setOnboardingLoaded] = useState(false)
  const [onboardingStep, setOnboardingStep] = useState(0)

  useEffect(() => {
    if (!isAuthenticated) return

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/onboarding")
        const data = await res.json()
        if (cancelled) return
        if (!data.error) {
          const completed: boolean = data.onboardingCompleted === true
          setOnboardingStep(typeof data.onboardingStep === "number" ? data.onboardingStep : 0)
          setShowWizard(!completed)
          setShowBanner(!completed)
        }
      } catch {
        // Non-fatal — don't block the app
      } finally {
        if (!cancelled) setOnboardingLoaded(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  const handleComplete = useCallback(() => {
    setShowWizard(false)
    setShowBanner(false)
  }, [])

  const handleSkip = useCallback(() => {
    setShowWizard(false)
    // Keep the banner visible after skipping
    setShowBanner(true)
  }, [])

  const openWizard = useCallback(() => {
    setShowWizard(true)
  }, [])

  return {
    showWizard,
    showBanner,
    onboardingLoaded,
    onboardingStep,
    handleComplete,
    handleSkip,
    openWizard,
  }
}
