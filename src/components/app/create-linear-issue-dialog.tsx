"use client"

import { useEffect, useState, type FormEvent } from "react"
import { SquareKanban } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type LinearTeam = {
  id: string
  name: string
  key: string
}

export function CreateLinearIssueDialog({
  open,
  onOpenChange,
  prefillTitle,
  prefillDescription,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  prefillTitle?: string
  prefillDescription?: string
}) {
  const [teams, setTeams] = useState<LinearTeam[]>([])
  const [saving, setSaving] = useState(false)
  const [loadingTeams, setLoadingTeams] = useState(false)
  const [form, setForm] = useState({
    title: prefillTitle ?? "",
    description: prefillDescription ?? "",
    teamId: "",
    priority: 0,
  })

  useEffect(() => {
    if (prefillTitle) setForm((current) => ({ ...current, title: prefillTitle }))
    if (prefillDescription) setForm((current) => ({ ...current, description: prefillDescription }))
  }, [prefillDescription, prefillTitle])

  useEffect(() => {
    if (!open) return
    setLoadingTeams(true)
    fetch("/api/linear?action=teams")
      .then((response) => response.json())
      .then((payload) => {
        if (payload.teams) {
          setTeams(payload.teams)
          if (payload.teams.length > 0 && !form.teamId) {
            setForm((current) => ({ ...current, teamId: payload.teams[0].id }))
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingTeams(false))
  }, [form.teamId, open])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.title || !form.teamId) return
    setSaving(true)

    try {
      const response = await fetch("/api/linear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          title: form.title,
          description: form.description || undefined,
          teamId: form.teamId,
          priority: form.priority,
        }),
      })
      const payload = await response.json()
      if (payload.error) throw new Error(payload.error)

      setForm({ title: "", description: "", teamId: teams[0]?.id ?? "", priority: 0 })
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to create Linear issue:", error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-[var(--ink-line)] bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-black">
            <SquareKanban className="h-5 w-5 text-[#127c66]" />
            Create Linear Issue
          </DialogTitle>
          <DialogDescription className="text-gray-500">
            Create a new issue in your Linear workspace.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div>
            <Label className="text-gray-600">Team</Label>
            {loadingTeams ? (
              <div className="mt-1 text-sm text-gray-400">Loading teams...</div>
            ) : (
              <Select value={form.teamId} onValueChange={(value) => setForm((current) => ({ ...current, teamId: value }))}>
                <SelectTrigger className="mt-1 border-[var(--ink-line)] bg-[#f4f0e6]">
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>{team.name} ({team.key})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label className="text-gray-600">Title</Label>
            <Input
              className="mt-1 border-[var(--ink-line)] bg-[#f4f0e6]"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Issue title"
              required
            />
          </div>
          <div>
            <Label className="text-gray-600">Description</Label>
            <Textarea
              className="mt-1 min-h-[80px] border-[var(--ink-line)] bg-[#f4f0e6]"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Optional description..."
            />
          </div>
          <div>
            <Label className="text-gray-600">Priority</Label>
            <Select value={String(form.priority)} onValueChange={(value) => setForm((current) => ({ ...current, priority: parseInt(value, 10) }))}>
              <SelectTrigger className="mt-1 border-[var(--ink-line)] bg-[#f4f0e6]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">No priority</SelectItem>
                <SelectItem value="1">Urgent</SelectItem>
                <SelectItem value="2">High</SelectItem>
                <SelectItem value="3">Medium</SelectItem>
                <SelectItem value="4">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2 pt-4">
            <Button type="button" variant="outline" className="border-[var(--ink-line)]" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="bg-[#18b897] text-[#0c111b] hover:bg-[#15a88a]" disabled={saving || !form.teamId}>
              {saving ? "Creating..." : "Create Issue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
