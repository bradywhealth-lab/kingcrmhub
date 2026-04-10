"use client"

import { useState, type FormEvent } from "react"
import { UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function AddLeadDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    title: "",
    source: "manual",
    estimatedValue: "",
  })

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName || null,
          lastName: form.lastName || null,
          email: form.email || null,
          phone: form.phone || null,
          company: form.company || null,
          title: form.title || null,
          source: form.source,
          estimatedValue: form.estimatedValue ? parseFloat(form.estimatedValue) : null,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || "Failed to create lead")
      }

      setForm({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        company: "",
        title: "",
        source: "manual",
        estimatedValue: "",
      })
      onCreated?.()
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create lead'
      setError(message)
      console.error('Add lead error:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-[#D7DFEA] bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-black">
            <UserPlus className="h-5 w-5 text-[#2563EB]" />
            Add new lead
          </DialogTitle>
          <DialogDescription className="text-gray-500">
            Create a lead manually. AI scoring can run after save.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-600">First name</Label>
              <Input className="mt-1 border-[#D7DFEA] bg-[#EEF2F7]" value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} placeholder="Jane" />
            </div>
            <div>
              <Label className="text-gray-600">Last name</Label>
              <Input className="mt-1 border-[#D7DFEA] bg-[#EEF2F7]" value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} placeholder="Doe" />
            </div>
          </div>
          <div>
            <Label className="text-gray-600">Email</Label>
            <Input type="email" className="mt-1 border-[#D7DFEA] bg-[#EEF2F7]" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="jane@company.com" />
          </div>
          <div>
            <Label className="text-gray-600">Phone</Label>
            <Input className="mt-1 border-[#D7DFEA] bg-[#EEF2F7]" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="+1 (555) 000-0000" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-600">Company</Label>
              <Input className="mt-1 border-[#D7DFEA] bg-[#EEF2F7]" value={form.company} onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))} placeholder="Acme Inc" />
            </div>
            <div>
              <Label className="text-gray-600">Title</Label>
              <Input className="mt-1 border-[#D7DFEA] bg-[#EEF2F7]" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="VP Sales" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-600">Source</Label>
              <Select value={form.source} onValueChange={(value) => setForm((current) => ({ ...current, source: value }))}>
                <SelectTrigger className="mt-1 border-[#D7DFEA] bg-[#EEF2F7]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-600">Est. value ($)</Label>
              <Input type="number" className="mt-1 border-[#D7DFEA] bg-[#EEF2F7]" value={form.estimatedValue} onChange={(event) => setForm((current) => ({ ...current, estimatedValue: event.target.value }))} placeholder="50000" />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4">
            <Button type="button" variant="outline" className="border-[#D7DFEA]" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="btn-gold" disabled={saving}>{saving ? "Saving..." : "Add lead"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
