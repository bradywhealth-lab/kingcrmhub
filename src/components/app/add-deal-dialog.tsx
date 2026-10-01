"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Handshake } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { buildApiPath } from "@/lib/api-client"

type Stage = { id: string; name: string }

/**
 * S29 — the Pipeline's only creation CTA previously opened the LEAD dialog, so the
 * board could never gain a deal. The backend path (`POST /api/pipeline`) already
 * existed with `createPipelineItemSchema`; only the UI was missing.
 *
 * This dialog is the missing UI. It loads the org's real stages from
 * `GET /api/pipeline` rather than trusting a prop, so the stage the user picks is
 * the stage the item lands in — which also makes the per-column "+" label
 * ("Add deal to <stage>") a truthful promise.
 */
export function AddDealDialog({
  open,
  onOpenChange,
  defaultStageId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultStageId?: string
  onCreated?: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [loadingStages, setLoadingStages] = useState(false)
  const [stages, setStages] = useState<Stage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ title: "", value: "", stageId: "", expectedClose: "" })

  const loadStages = useCallback(async () => {
    setLoadingStages(true)
    try {
      const response = await fetch(buildApiPath("/api/pipeline"))
      const payload = await response.json()
      const next: Stage[] = (payload?.pipeline?.stages ?? []).map((s: Stage) => ({ id: s.id, name: s.name }))
      setStages(next)
      setForm((current) => ({
        ...current,
        stageId: current.stageId || defaultStageId || next[0]?.id || "",
      }))
    } catch {
      setError("Could not load pipeline stages.")
    } finally {
      setLoadingStages(false)
    }
  }, [defaultStageId])

  useEffect(() => {
    if (open) void loadStages()
  }, [open, loadStages])

  const reset = () => setForm({ title: "", value: "", stageId: defaultStageId || "", expectedClose: "" })

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!form.title.trim()) {
      setError("Deal name is required.")
      return
    }
    if (form.value && Number(form.value) < 0) {
      setError("Deal value cannot be negative.")
      return
    }

    setSaving(true)
    try {
      const response = await fetch(buildApiPath("/api/pipeline"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          stageId: form.stageId || undefined,
          value: form.value ? Number(form.value) : undefined,
          expectedClose: form.expectedClose || undefined,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || "Failed to create deal")
      }

      reset()
      onOpenChange(false)
      onCreated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create deal")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Handshake className="h-5 w-5 text-[var(--accent-text)]" />
            Add new deal
          </DialogTitle>
          <DialogDescription>
            Track a new deal on your pipeline board. Pick the stage it should start in.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div>
            <Label htmlFor="deal-title" className="mb-2 block">Deal name</Label>
            <Input
              id="deal-title"
              name="title"
              required
              className="h-12 rounded-2xl"
              placeholder="e.g. Acme — 20-seat rollout"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="deal-value" className="mb-2 block">Value</Label>
            <Input
              id="deal-value"
              name="value"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              className="h-12 rounded-2xl"
              placeholder="0"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="deal-stage" className="mb-2 block">Stage</Label>
            <Select
              value={form.stageId}
              onValueChange={(value) => setForm({ ...form, stageId: value })}
              disabled={loadingStages || stages.length === 0}
            >
              <SelectTrigger id="deal-stage" className="h-12 rounded-2xl">
                <SelectValue placeholder={loadingStages ? "Loading stages…" : "Select a stage"} />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="deal-close" className="mb-2 block">Expected close</Label>
            <Input
              id="deal-close"
              name="expectedClose"
              type="date"
              className="h-12 rounded-2xl"
              value={form.expectedClose}
              onChange={(e) => setForm({ ...form, expectedClose: e.target.value })}
            />
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="inline-flex min-h-[24px] items-center"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || stages.length === 0}
              className="btn-gold"
            >
              {saving ? "Adding…" : "Add deal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}