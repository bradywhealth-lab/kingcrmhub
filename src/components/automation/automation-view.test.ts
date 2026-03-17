import { describe, expect, it, vi } from "vitest"

import { openCreateAutomationDialog, submitAutomation } from "@/components/automation/automation-view"

describe("AutomationView helpers", () => {
  it("opens create automation dialog from button click handler", () => {
    const setOpen = vi.fn()

    openCreateAutomationDialog(setOpen)

    expect(setOpen).toHaveBeenCalledWith(true)
  })

  it("submits automation and fires success callback", async () => {
    const fetchAutomations = vi.fn().mockResolvedValue(undefined)
    const onCreateSuccess = vi.fn()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ automation: { id: "a1" } }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await submitAutomation({
      name: "Welcome Flow",
      trigger: "new lead",
      actions: "send email",
      fetchAutomations,
      onCreateSuccess,
    })

    expect(fetchMock).toHaveBeenCalledWith("/api/automations", expect.objectContaining({ method: "POST" }))
    expect(fetchAutomations).toHaveBeenCalledTimes(1)
    expect(onCreateSuccess).toHaveBeenCalledTimes(1)

    vi.unstubAllGlobals()
  })
})
