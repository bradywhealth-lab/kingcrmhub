"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
    color: "var(--teal)",
  },
  {
    id: "organization",
    title: "Set up your workspace",
    subtitle: "Confirm your workspace details so everything looks right.",
    icon: Building2,
    color: "var(--teal)",
  },
  {
    id: "carrier",
    title: "Add your first offer package",
    subtitle: "Add an offer or service package to your library so the AI can match clients to what you sell.",
    icon: FileText,
    color: "var(--teal)",
  },
  {
    id: "lead",
    title: "Add your first client",
    subtitle: "Drop in a contact to see how the CRM works end-to-end.",
    icon: UserPlus,
    color: "var(--teal)",
    optional: true,
  },
  {
    id: "automation",
    title: "Enable a quick automation",
    subtitle: "Set a follow-up rule that fires when a new client lands.",
    icon: Zap,
    color: "var(--teal)",
    optional: true,
  },
  {
    id: "done",
    title: "You're all set",
    subtitle: "Your workspace is ready. Time to make your next move.",
    icon: Bot,
    color: "var(--teal)",
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
                status === "done" && "border-[var(--teal-deep)] bg-[var(--teal-deep)] text-white",
                status === "active" && "border-[var(--teal)] bg-[var(--teal-deep)] text-white shadow-[0_0_12px_rgba(18,124,102,0.45)]",
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
                  index < currentIndex ? "bg-[var(--teal-deep)]" : "bg-[rgba(31,42,54,0.1)]"
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
        className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-[var(--teal)] shadow-[0_20px_40px_rgba(18,124,102,0.28)]"
      >
        <Sparkles className="h-9 w-9 text-[var(--ink)]" />
      </motion.div>

      <div className="space-y-3">
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-3xl font-semibold tracking-[-0.03em] text-[#0c111b]"
        >
          Welcome{userName ? `, ${userName.split(" ")[0]}` : ""}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-lg text-[#0c111b]/60"
        >
          <span className="font-semibold text-[var(--teal-deep)]">{organizationName}</span> is ready for setup.
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mx-auto max-w-md text-sm leading-7 text-[#0c111b]/55"
        >
          We'll walk you through a few quick steps to get your pipeline, offers, and prompts running.
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
          { label: "Follow-up guidance", desc: "Know who to contact next" },
          { label: "Prompt library", desc: "Copy-ready client prompts" },
          { label: "Pipeline", desc: "Drag & drop clients" },
        ].map((feature) => (
          <div
            key={feature.label}
            className="rounded-2xl border border-[rgba(31,42,54,0.08)] bg-[#f8f5ec] p-3 text-center"
          >
            <p className="text-xs font-semibold text-[#0c111b]">{feature.label}</p>
            <p className="mt-0.5 text-[11px] text-[#0c111b]/50">{feature.desc}</p>
          </div>
        ))}
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
        <Button
          onClick={onNext}
          className="h-12 rounded-2xl bg-[var(--teal)] px-8 text-[var(--ink)] shadow-[0_12px_28px_rgba(18,124,102,0.24)] hover:opacity-95"
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
          <Label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0c111b]/52">
            Organization name
          </Label>
          <Input
            className="h-12 rounded-2xl border-[rgba(31,42,54,0.1)] bg-white shadow-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your business name (e.g. Alex Design Co.)"
          />
        </div>
        <div>
          <Label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0c111b]/52">
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
          className="h-11 rounded-2xl border-[rgba(31,42,54,0.1)] text-[#0c111b]/60"
          onClick={onSkip}
        >
          Skip for now
        </Button>
        <Button
          onClick={() => void handleSave()}
          disabled={saving}
          className="h-11 flex-1 rounded-2xl bg-[var(--teal)] text-[var(--ink)] shadow-[0_8px_20px_rgba(18,124,102,0.2)] hover:opacity-95"
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
      toast({ title: "Offer name required", description: "Enter the offer package's name.", variant: "destructive" })
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
      toast({ title: "Offer added", description: `${name} is now in your offer library.` })
      onNext()
    } catch (error) {
      toast({
        title: "Failed to add offer",
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
          <Label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0c111b]/52">
            Offer name
          </Label>
          <Input
            className="h-12 rounded-2xl border-[rgba(31,42,54,0.1)] bg-white shadow-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Website Redesign Package, Monthly Retainer"
          />
        </div>
        <div>
          <Label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0c111b]/52">
            Website{" "}
            <span className="normal-case font-normal tracking-normal text-[rgba(31,42,54,0.38)]">(optional)</span>
          </Label>
          <Input
            className="h-12 rounded-2xl border-[rgba(31,42,54,0.1)] bg-white shadow-sm"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://yourportfolio.com"
          />
        </div>
        <div>
          <Label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0c111b]/52">
            Notes{" "}
            <span className="normal-case font-normal tracking-normal text-[rgba(31,42,54,0.38)]">(optional)</span>
          </Label>
          <Input
            className="h-12 rounded-2xl border-[rgba(31,42,54,0.1)] bg-white shadow-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Best for small business clients, 2-week turnaround…"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-[rgba(24,184,151,0.18)] bg-[#f4f0e6] p-4 text-sm text-[#0c111b]/65">
        You can add more offers and upload service documents in{" "}
        <span className="font-semibold text-[var(--teal-deep)]">Settings → Offers</span> at any time.
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          className="h-11 rounded-2xl border-[rgba(31,42,54,0.1)] text-[#0c111b]/60"
          onClick={onSkip}
        >
          Skip for now
        </Button>
        <Button
          onClick={() => void handleSave()}
          disabled={saving}
          className="h-11 flex-1 rounded-2xl bg-[var(--teal)] text-[var(--ink)] shadow-[0_8px_20px_rgba(18,124,102,0.2)] hover:opacity-95"
        >
          {saving ? "Adding offer…" : "Add offer & continue"}
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
      toast({ title: "Client added", description: "Your first client is in the system." })
      onNext()
    } catch (error) {
      toast({
        title: "Failed to add client",
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
          <Label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0c111b]/52">
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
          <Label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0c111b]/52">
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
          <Label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0c111b]/52">
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
          <Label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0c111b]/52">
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
          className="h-11 rounded-2xl border-[rgba(31,42,54,0.1)] text-[#0c111b]/60"
          onClick={onSkip}
        >
          Skip for now
        </Button>
        <Button
          onClick={() => void handleSave()}
          disabled={saving}
          className="h-11 flex-1 rounded-2xl bg-[var(--teal)] text-[var(--ink)] shadow-[0_8px_20px_rgba(18,124,102,0.2)] hover:opacity-95"
        >
          {saving ? "Adding client…" : "Add client & continue"}
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
          name: "New client — immediate follow-up",
          description: "Automatically flags new clients for a 5-minute follow-up reminder.",
          trigger: "lead_created",
          triggerConfig: { source: "crm" },
          conditions: {},
          actions: [{ type: "create_task", target: "Follow up within 5 minutes" }],
          isActive: true,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: "Automation enabled", description: "Follow-up reminder is now active for new clients." })
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
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(18,124,102,0.12)]">
            <Zap className="h-5 w-5 text-[var(--teal-deep)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--ink)]">New client — immediate follow-up</p>
            <p className="mt-1 text-sm text-[#0c111b]/60">
              When a new client is created, automatically create a task: "Follow up within 5 minutes".
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-[rgba(18,124,102,0.28)] bg-[rgba(18,124,102,0.08)] px-3 py-1 text-xs text-[var(--teal-deep)]">
                Trigger: Client created
              </span>
              <span className="rounded-full border border-[rgba(18,124,102,0.28)] bg-[rgba(18,124,102,0.08)] px-3 py-1 text-xs text-[var(--teal-deep)]">
                Action: Create task
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-sm text-[#0c111b]/55">
        You can customize triggers and actions in the{" "}
        <span className="font-semibold text-[var(--teal-deep)]">AI Automation</span> section at any time.
      </p>

      <div className="flex gap-3">
        <Button
          variant="outline"
          className="h-11 rounded-2xl border-[rgba(31,42,54,0.1)] text-[#0c111b]/60"
          onClick={onSkip}
        >
          Skip for now
        </Button>
        <Button
          onClick={() => void handleEnable()}
          disabled={saving}
          className="h-11 flex-1 rounded-2xl bg-[var(--teal)] text-[var(--ink)] shadow-[0_8px_20px_rgba(18,124,102,0.2)] hover:opacity-95"
        >
          {saving ? "Enabling…" : "Enable automation & finish"}
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
        className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-[var(--teal)] shadow-[0_20px_40px_rgba(18,124,102,0.28)]"
      >
        <Check className="h-9 w-9 text-[var(--ink)]" />
      </motion.div>

      <div className="space-y-2">
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-3xl font-semibold tracking-[-0.03em] text-[#0c111b]"
        >
          You're all set
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="text-lg text-[#0c111b]/60"
        >
          Your workspace is ready. Time to make your next move.
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
          "Your contacts table has AI scoring built in",
          "Pipeline is your drag-and-drop kanban board",
          "Settings → Offers to upload documents for AI",
          "Settings → AI Configuration to change your AI provider",
        ].map((item) => (
          <div key={item} className="flex items-center gap-3 text-sm text-[#0c111b]/65">
            <Check className="h-4 w-4 shrink-0 text-[var(--teal-deep)]" />
            {item}
          </div>
        ))}
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        <Button
          onClick={onFinish}
          className="h-12 rounded-2xl bg-[var(--teal)] px-8 text-[var(--ink)] shadow-[0_12px_28px_rgba(18,124,102,0.24)] hover:opacity-95"
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
        body: JSON.stringify({ completed: false, step: currentStep }),
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
            className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-[#0c111b]/35 transition-colors hover:bg-[rgba(31,42,54,0.06)] hover:text-[#0c111b]"
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
                <p className="text-xs font-medium text-[#0c111b]/45">
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
                style={{ backgroundColor: `color-mix(in srgb, ${step.color} 10%, transparent)` }}
              >
                <step.icon className="h-5 w-5" style={{ color: step.color }} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#0c111b]">{step.title}</h3>
                <p className="text-sm text-[#0c111b]/55">{step.subtitle}</p>
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
              {/* Render by step id so adding or reordering steps does not shift the rendering branches. */}
              {step.id === "welcome" && (
                <WelcomeStep
                  organizationName={organizationName}
                  userName={userName}
                  onNext={() => void advance(false)}
                />
              )}
              {step.id === "organization" && (
                <OrganizationStep
                  initialName={organizationName}
                  onNext={() => void advance(false)}
                  onSkip={() => void advance(true)}
                />
              )}
              {step.id === "packages" && (
                <CarrierStep
                  onNext={() => void advance(false)}
                  onSkip={() => void advance(true)}
                />
              )}
              {step.id === "lead" && (
                <LeadStep
                  onNext={() => void advance(false)}
                  onSkip={() => void advance(true)}
                />
              )}
              {step.id === "automation" && (
                <AutomationStep
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

export function useOnboarding(isAuthenticated: boolean, organizationId?: string | null) {
  const [showWizard, setShowWizard] = useState(false)
  const [showBanner, setShowBanner] = useState(false)
  const [onboardingLoaded, setOnboardingLoaded] = useState(false)
  const [onboardingStep, setOnboardingStep] = useState(0)

  // "Skip setup" must survive reloads, but the org row intentionally stays
  // incomplete so the wizard can be resumed from Settings. The dismissal is
  // therefore browser-persisted separately from server completion state
  // (cubic P2, PR #161: persisting completed:false made the overlay re-open
  // on every reload; persisting completed:true made resume impossible).
  //
  // The flag is scoped per organization: a global key would let one
  // workspace's skip suppress the next account's first-run wizard in the
  // same browser profile (cubic P2 round 3).
  // Read via ref so callbacks never capture a stale pre-auth key (cubic P2
  // round 4: orgId loads async; []-dep callbacks froze the ':anon' key).
  const dismissKey = `kingcrm-onboarding-dismissed:${organizationId ?? 'anon'}`
  const dismissKeyRef = useRef(dismissKey)
  useEffect(() => {
    dismissKeyRef.current = dismissKey
  }, [dismissKey])
  const isDismissed = () => {
    try { return localStorage.getItem(dismissKeyRef.current) === "1" } catch { return false }
  }
  const setDismissed = (value: boolean) => {
    try {
      if (value) localStorage.setItem(dismissKeyRef.current, "1")
      else localStorage.removeItem(dismissKeyRef.current)
    } catch {
      // private mode — dismissal degrades to per-tab, still better than reopen loop
    }
  }

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
          setShowWizard(!completed && !isDismissed())
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
  }, [isAuthenticated, organizationId])

  const handleComplete = useCallback(() => {
    setShowWizard(false)
    setShowBanner(false)
    setDismissed(false)
  }, [])

  const handleSkip = useCallback(() => {
    setShowWizard(false)
    // Keep the banner visible after skipping
    setShowBanner(true)
    setDismissed(true)
  }, [])

  const openWizard = useCallback(() => {
    setDismissed(false)
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
