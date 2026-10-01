"use client"

import { useEffect, useState, type FormEvent } from "react"
import { TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { buildCreateDealPayload, validateDealDraft } from "@/components/app/add-deal-payload"

type Stage = { id: string; name: string }

/**
 * Add Deal dialog — S29 fix.
 *
 * ## The defect this replaces
 * `page.tsx`'s "Add Deal" button dispatched `CustomEvent("open-add-lead")`, whose
 * only listener opened the **Add Lead** dialog. So on the Pipeline board, the
 * button labelled "Add Deal" created a lead, never a deal. The pipeline's own
 * stage-header "+" did the same.
 *
 * ## Why this is a wiring fix, not a new API
 * `POST /api/pipeline` already creates a pipeline item (title / value / stageId /
 * probability / expectedClose per `createPipelineItemSchema`). Nothing server-side
 * was missing — the UI simply never called it.
 *
 * The payload shape lives in `add-deal-payload.ts` so it is unit-testable: this
 * repo has no jsdom/@testing-library, so logic inside a component cannot be
 * exercised by a test.
 */
export function AddDealDialog({
  open,
  onOpenChange,
  onCreated,
  defaultStageId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
  defaultStageId?: string | null
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stages, setStages] = useState<Stage[]>([])
  const [form, setForm] = useState({ title: "", value: "", stageId: "" })

  // Load the pipeline's stages so the user can place the deal deliberately.
  // The API omits stageId -> server picks the first stage, so a failed stage
  // load is not fatal; the select simply stays empty.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/pipeline")
        const payload = await res.json()
        if (payload?.error) throw new Error(payload.error)
        // GET /api/pipeline returns { pipeline: { stages: [...] }, metrics: {...} }
        // (src/app/api/pipeline/route.ts:112-119) — the stages are NESTED under
        // `pipeline`, exactly as page.tsx:1536 reads them via
        // normalizePipelineStages(data.pipeline?.stages). Reading payload.stages
        // instead silently yields zero stages and an empty select.
        const rawStages = payload?.pipeline?.stages
        const loaded: Stage[] = Array.isArray(rawStages)
          ? rawStages.map((s: Stage) => ({ id: s.id, name: s.name }))
          : []
        if (cancelled) return
        setStages(loaded)
        // Honour the stage the "+" button was clicked in, else default to first.
        setForm((current) => ({
          ...current,
          stageId: defaultStageId || loaded[0]?.id || "",
        }))
      } catch {
        if (!cancelled) setStages([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, defaultStageId])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    // Validate against the SAME limits the server enforces, so the user gets a
    // real reason instead of a generic 400. (This is the S10 lesson: a field
    // that silently blocks a save is worse than one that explains itself.)
    const check = validateDealDraft(form)
    if (!check.ok) {
      setError(check.reason)
      return
    }

    setSaving(true)
    try {
      const response = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCreateDealPayload(form)),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        // Surface field-level issues when the API provides them rather than the
        // generic "Invalid request body".
        const issue = Array.isArray(payload?.issues) && payload.issues[0]
          ? `${payload.issues[0].path}: ${payload.issues[0].message}`
          : null
        throw new Error(issue || payload?.error || "Failed to create deal")
      }

      setForm({ title: "", value: "", stageId: "" })
      onCreated?.()
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create deal"
      setError(message)
      console.error("Add deal error:", err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-[var(--ink-line)] bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <TrendingUp className="h-5 w-5 text-[var(--accent-text)]" />
            Add deal
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Create a pipeline deal. It lands in the stage you pick and counts toward your live total.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <Label htmlFor="deal-title" className="text-muted-foreground">Deal name</Label>
            <Input
              id="deal-title"
              name="title"
              required
              maxLength={200}
              autoComplete="off"
              className="mt-1 border-[var(--ink-line)] bg-muted"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Acme renewal"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="deal-value" className="text-muted-foreground">Value ($)</Label>
              <Input
                id="deal-value"
                name="value"
                type="number"
                min="0"
                step="any"
                className="mt-1 border-[var(--ink-line)] bg-muted"
                value={form.value}
                onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))}
                placeholder="50000"
              />
            </div>
            <div>
              <Label className="text-muted-foreground">Stage</Label>
              <Select
                value={form.stageId}
                onValueChange={(value) => setForm((current) => ({ ...current, stageId: value }))}
              >
                <SelectTrigger className="mt-1 border-[var(--ink-line)] bg-muted">
                  <SelectValue placeholder={stages.length ? "Select stage" : "First stage"} />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-4">
            <Button type="button" variant="outline" className="border-[var(--ink-line)]" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="btn-gold" disabled={saving}>
              {saving ? "Adding..." : "Add deal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
