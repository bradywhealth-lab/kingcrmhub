"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Activity, Brain, Plus, Zap } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"

type Automation = {
  id: string
  name: string
  trigger: string
  actions: string
}

type AutomationViewProps = {
  onCreateSuccess?: () => void
}

type SubmitAutomationParams = {
  name: string
  trigger: string
  actions: string
  fetchAutomations: () => Promise<void>
  onCreateSuccess?: () => void
}

export function openCreateAutomationDialog(setShowCreateAutomationDialog: (open: boolean) => void) {
  setShowCreateAutomationDialog(true)
}

export async function submitAutomation({ name, trigger, actions, fetchAutomations, onCreateSuccess }: SubmitAutomationParams) {
  const response = await fetch("/api/automations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim(), trigger: trigger.trim(), actions: actions.trim() }),
  })
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to create automation")
  }

  await fetchAutomations()
  onCreateSuccess?.()
}

export function AutomationView({ onCreateSuccess }: AutomationViewProps) {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loadingAutomations, setLoadingAutomations] = useState(true)
  const [showCreateAutomationDialog, setShowCreateAutomationDialog] = useState(false)
  const [name, setName] = useState("")
  const [trigger, setTrigger] = useState("")
  const [actions, setActions] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchAutomations = useCallback(async () => {
    setLoadingAutomations(true)
    try {
      const response = await fetch("/api/automations")
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load automations")
      }
      setAutomations(Array.isArray(payload.automations) ? payload.automations : [])
    } catch (error) {
      toast({
        title: "Unable to load automations",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
      setAutomations([])
    } finally {
      setLoadingAutomations(false)
    }
  }, [])

  useEffect(() => {
    void fetchAutomations()
  }, [fetchAutomations])

  const resetForm = () => {
    setName("")
    setTrigger("")
    setActions("")
  }

  const handleCreateAutomation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return

    if (!name.trim() || !trigger.trim() || !actions.trim()) {
      toast({
        title: "Missing required fields",
        description: "Name, trigger, and actions are required.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      await submitAutomation({ name, trigger, actions, fetchAutomations, onCreateSuccess })
      toast({
        title: "Automation created",
        description: "Your automation is now active.",
      })
      setShowCreateAutomationDialog(false)
      resetForm()
    } catch (error) {
      toast({
        title: "Failed to create automation",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 space-y-6 bg-[#FDFBF7] min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black">AI Automation</h1>
          <p className="text-gray-500">Automate your workflows with intelligent triggers</p>
        </div>
        <Button className="btn-gold gap-2" onClick={() => openCreateAutomationDialog(setShowCreateAutomationDialog)}>
          <Plus className="w-4 h-4" />
          Create Automation
        </Button>
      </div>

      <Dialog open={showCreateAutomationDialog} onOpenChange={setShowCreateAutomationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create automation</DialogTitle>
            <DialogDescription>Set a name, trigger, and actions to start an automation workflow.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateAutomation} className="space-y-4" data-testid="create-automation-form">
            <fieldset disabled={isSubmitting} className="space-y-4 disabled:opacity-70">
              <div className="space-y-2">
                <Label htmlFor="automation-name">Name</Label>
                <Input id="automation-name" value={name} onChange={(event) => setName(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="automation-trigger">Trigger</Label>
                <Input id="automation-trigger" value={trigger} onChange={(event) => setTrigger(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="automation-actions">Actions</Label>
                <Textarea id="automation-actions" value={actions} onChange={(event) => setActions(event.target.value)} required />
              </div>
            </fieldset>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateAutomationDialog(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create automation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: "Active Automations", value: automations.length, icon: Zap },
          { title: "Runs This Month", value: 1234, icon: Activity },
          { title: "AI Accuracy", value: "94%", icon: Brain },
        ].map((stat) => (
          <Card key={stat.title} className="bg-white border-[#E2DDD4] shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#3B8595]/20 flex items-center justify-center">
                  <stat.icon className="w-5 h-5 text-[#3B8595]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-black">{stat.value}</p>
                  <p className="text-sm text-gray-500">{stat.title}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-white border-[#E2DDD4] shadow-sm">
        <CardContent className="p-4">
          <p className="text-sm font-semibold text-black mb-3">Current automations</p>
          {loadingAutomations ? (
            <p className="text-sm text-gray-500">Loading automations...</p>
          ) : automations.length === 0 ? (
            <p className="text-sm text-gray-500">No automations created yet.</p>
          ) : (
            <ul className="space-y-2">
              {automations.map((automation) => (
                <li key={automation.id} className="rounded-md border border-[#E2DDD4] p-3">
                  <p className="font-medium text-black">{automation.name}</p>
                  <p className="text-xs text-gray-600">Trigger: {automation.trigger}</p>
                  <p className="text-xs text-gray-600">Actions: {automation.actions}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
