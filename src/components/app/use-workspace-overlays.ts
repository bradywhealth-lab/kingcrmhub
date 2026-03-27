"use client"

import { useCallback, useEffect, useState } from "react"
import { useCommandPalette } from "@/components/command-palette"
import { toast } from "@/hooks/use-toast"
import { buildApiPath, readApiJsonOrText } from "@/lib/api-client"

export function useWorkspaceOverlays() {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [showAddLeadDialog, setShowAddLeadDialog] = useState(false)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [showLinearIssueDialog, setShowLinearIssueDialog] = useState(false)
  const [linearIssuePrefill, setLinearIssuePrefill] = useState<{ title?: string; description?: string }>({})
  const [leadsRefreshKey, setLeadsRefreshKey] = useState(0)
  const [uploadsRefreshKey, setUploadsRefreshKey] = useState(0)
  const [showScrapeDialog, setShowScrapeDialog] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [scrapeJobs, setScrapeJobs] = useState<Array<{ id: string; status: string; sourceUrl: string; createdAt: string }>>([])
  const [scrapeForm, setScrapeForm] = useState({
    url: "",
    type: "website",
    maxPages: 15,
    followLinks: true,
    useHeadless: true,
    delayMs: 500,
    rotateUserAgent: true,
    respectRobots: false,
    proxyEnabled: false,
    proxyProvider: "none",
    proxyUrlTemplate: "",
  })
  const [uploading, setUploading] = useState(false)

  useCommandPalette(() => setCommandPaletteOpen(true))

  useEffect(() => {
    const linearHandler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { title?: string; description?: string }
      setLinearIssuePrefill(detail)
      setShowLinearIssueDialog(true)
    }
    window.addEventListener("create-linear-issue", linearHandler)
    return () => window.removeEventListener("create-linear-issue", linearHandler)
  }, [])

  useEffect(() => {
    const leadHandler = () => setShowAddLeadDialog(true)
    window.addEventListener("open-add-lead", leadHandler)
    return () => window.removeEventListener("open-add-lead", leadHandler)
  }, [])

  const loadScrapeJobs = useCallback(async () => {
    try {
      const response = await fetch(buildApiPath("/api/scrape?limit=10"))
      const payload = await response.json()
      if (!payload.error) setScrapeJobs(payload.jobs || [])
    } catch {
      setScrapeJobs([])
    }
  }, [])

  useEffect(() => {
    void loadScrapeJobs()
  }, [loadScrapeJobs])

  const handleScrapeSubmit = useCallback(async () => {
    if (!scrapeForm.url.trim()) {
      toast({ title: "URL required", description: "Enter a website or directory URL to scrape.", variant: "destructive" })
      return
    }

    setScraping(true)
    try {
      const response = await fetch(buildApiPath("/api/scrape"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: scrapeForm.url,
          type: scrapeForm.type,
          maxPages: scrapeForm.maxPages,
          followLinks: scrapeForm.followLinks,
          useHeadless: scrapeForm.useHeadless,
          delayMs: scrapeForm.delayMs,
          rotateUserAgent: scrapeForm.rotateUserAgent,
          respectRobots: scrapeForm.respectRobots,
          proxyEnabled: scrapeForm.proxyEnabled,
          proxyProvider: scrapeForm.proxyProvider,
          proxyUrlTemplate: scrapeForm.proxyUrlTemplate,
        }),
      })
      const payload = await response.json()
      if (payload.error) throw new Error(payload.error)

      toast({ title: "Scrape started", description: "Job queued. Leads will appear as source=scrape." })
      setShowScrapeDialog(false)
      setScrapeForm((current) => ({ ...current, url: "" }))
      setLeadsRefreshKey((current) => current + 1)
      void loadScrapeJobs()
    } catch (error) {
      toast({
        title: "Scrape failed to start",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setScraping(false)
    }
  }, [loadScrapeJobs, scrapeForm])

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append("file", file)
    formData.append("source", "csv_upload")
    formData.append("aiAutoScore", "true")

    try {
      const response = await fetch(buildApiPath("/api/upload"), { method: "POST", body: formData })
      const { data: result, text } = await readApiJsonOrText(response)
      if (!result) {
        throw new Error(`Upload API returned non-JSON (${response.status}). ${text?.slice(0, 120) || ""}`.trim())
      }
      if (result.error) throw new Error(result.details ? `${result.error}: ${result.details}` : result.error)

      toast({
        title: "Import complete",
        description: result.message || `Successfully imported ${result.upload?.successfulRows ?? 0} leads`,
      })
      setShowUploadDialog(false)
      setLeadsRefreshKey((current) => current + 1)
      setUploadsRefreshKey((current) => current + 1)
    } catch (error) {
      console.error("Upload error:", error)
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }, [])

  const openLinearIssueDialog = useCallback((prefill: { title?: string; description?: string } = {}) => {
    setLinearIssuePrefill(prefill)
    setShowLinearIssueDialog(true)
  }, [])

  const handleLeadCreated = useCallback(() => {
    setLeadsRefreshKey((current) => current + 1)
  }, [])

  return {
    commandPaletteOpen,
    setCommandPaletteOpen,
    showAddLeadDialog,
    setShowAddLeadDialog,
    showUploadDialog,
    setShowUploadDialog,
    showLinearIssueDialog,
    setShowLinearIssueDialog,
    linearIssuePrefill,
    openLinearIssueDialog,
    leadsRefreshKey,
    uploadsRefreshKey,
    handleLeadCreated,
    showScrapeDialog,
    setShowScrapeDialog,
    scraping,
    scrapeJobs,
    scrapeForm,
    setScrapeForm,
    handleScrapeSubmit,
    uploading,
    handleFileUpload,
  }
}
