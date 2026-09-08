"use client"

import { FileSpreadsheet, Globe, RefreshCw, Upload } from "lucide-react"
import { AddLeadDialog } from "@/components/app/add-lead-dialog"
import { CreateLinearIssueDialog } from "@/components/app/create-linear-issue-dialog"
import { CommandPalette } from "@/components/command-palette"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

type ScrapeJob = {
  id: string
  status: string
  sourceUrl: string
  createdAt: string
}

type ScrapeForm = {
  url: string
  type: string
  maxPages: number
  followLinks: boolean
  useHeadless: boolean
  delayMs: number
  rotateUserAgent: boolean
  respectRobots: boolean
  proxyEnabled: boolean
  proxyProvider: string
  proxyUrlTemplate: string
}

export function WorkspaceOverlays({
  showAddLeadDialog,
  setShowAddLeadDialog,
  onLeadCreated,
  showUploadDialog,
  setShowUploadDialog,
  uploading,
  onFileUpload,
  showScrapeDialog,
  setShowScrapeDialog,
  scrapeForm,
  setScrapeForm,
  scraping,
  onScrapeSubmit,
  scrapeJobs,
  showLinearIssueDialog,
  setShowLinearIssueDialog,
  linearIssuePrefill,
  commandPaletteOpen,
  setCommandPaletteOpen,
  onNavigate,
  onAddLead,
  onUploadCSV,
}: {
  showAddLeadDialog: boolean
  setShowAddLeadDialog: (open: boolean) => void
  onLeadCreated: () => void
  showUploadDialog: boolean
  setShowUploadDialog: (open: boolean) => void
  uploading: boolean
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
  showScrapeDialog: boolean
  setShowScrapeDialog: (open: boolean) => void
  scrapeForm: ScrapeForm
  setScrapeForm: React.Dispatch<React.SetStateAction<ScrapeForm>>
  scraping: boolean
  onScrapeSubmit: () => void | Promise<void>
  scrapeJobs: ScrapeJob[]
  showLinearIssueDialog: boolean
  setShowLinearIssueDialog: (open: boolean) => void
  linearIssuePrefill: { title?: string; description?: string }
  commandPaletteOpen: boolean
  setCommandPaletteOpen: (open: boolean) => void
  onNavigate: (view: string) => void
  onAddLead: () => void
  onUploadCSV: () => void
}) {
  return (
    <>
      <AddLeadDialog
        open={showAddLeadDialog}
        onOpenChange={setShowAddLeadDialog}
        onCreated={onLeadCreated}
      />

      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-lg border-[var(--ink-line)] bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-black">
              <Upload className="h-5 w-5 text-[#127c66]" />
              Import Leads from CSV
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Upload a CSV file to bulk import leads. AI will automatically score each lead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="upload-zone rounded-lg p-8 text-center">
              <FileSpreadsheet className="mx-auto mb-4 h-12 w-12 text-[#127c66]" />
              <p className="mb-2 text-sm text-gray-600">Drag and drop your CSV file here, or</p>
              <Label htmlFor="global-csv-upload" className="btn-gold inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2">
                <Upload className="h-4 w-4" />
                Browse Files
              </Label>
              <Input
                id="global-csv-upload"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={onFileUpload}
                disabled={uploading}
              />
            </div>
            <div className="space-y-2 rounded-lg bg-[#f4f0e6] p-4">
              <h4 className="text-sm font-medium text-black">CSV Format Requirements:</h4>
              <ul className="space-y-1 text-xs text-gray-600">
                <li>• First row must contain headers</li>
                <li>• Required: Email or Phone</li>
                <li>• Optional: First Name, Last Name, Company, Title</li>
                <li>• Duplicate detection on email/phone</li>
              </ul>
            </div>
            {uploading && (
              <div className="flex items-center justify-center gap-2 text-[#127c66]">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span className="text-sm">Processing...</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showScrapeDialog} onOpenChange={setShowScrapeDialog}>
        <DialogContent className="max-w-2xl border-[var(--ink-line)] bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-black">
              <Globe className="h-5 w-5 text-[#127c66]" />
              Scrape Leads from Websites & Directories
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Runs a background scrape job with JS/headless support (when configured) and auto-dedupes leads.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-600">Target URL</Label>
              <Input
                className="mt-1 border-[var(--ink-line)] bg-[#f4f0e6]"
                placeholder="https://example.com/directory"
                value={scrapeForm.url}
                onChange={(event) => setScrapeForm((current) => ({ ...current, url: event.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <Label className="text-gray-600">Type</Label>
                <Select value={scrapeForm.type} onValueChange={(value) => setScrapeForm((current) => ({ ...current, type: value }))}>
                  <SelectTrigger className="mt-1 border-[var(--ink-line)] bg-[#f4f0e6]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="directory">Directory</SelectItem>
                    <SelectItem value="sitemap">Sitemap</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-600">Max pages</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  className="mt-1 border-[var(--ink-line)] bg-[#f4f0e6]"
                  value={scrapeForm.maxPages}
                  onChange={(event) => setScrapeForm((current) => ({ ...current, maxPages: Number(event.target.value) || 15 }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-600">Options</Label>
                <div className="flex items-center justify-between rounded border border-[var(--ink-line)] bg-[#f4f0e6] p-2">
                  <span className="text-xs text-gray-600">Follow links</span>
                  <Switch checked={scrapeForm.followLinks} onCheckedChange={(value) => setScrapeForm((current) => ({ ...current, followLinks: value }))} />
                </div>
                <div className="flex items-center justify-between rounded border border-[var(--ink-line)] bg-[#f4f0e6] p-2">
                  <span className="text-xs text-gray-600">Use headless/JS</span>
                  <Switch checked={scrapeForm.useHeadless} onCheckedChange={(value) => setScrapeForm((current) => ({ ...current, useHeadless: value }))} />
                </div>
                <div className="flex items-center justify-between rounded border border-[var(--ink-line)] bg-[#f4f0e6] p-2">
                  <span className="text-xs text-gray-600">Rotate user agent</span>
                  <Switch checked={scrapeForm.rotateUserAgent} onCheckedChange={(value) => setScrapeForm((current) => ({ ...current, rotateUserAgent: value }))} />
                </div>
                <div className="flex items-center justify-between rounded border border-[var(--ink-line)] bg-[#f4f0e6] p-2">
                  <span className="text-xs text-gray-600">Respect robots.txt</span>
                  <Switch checked={scrapeForm.respectRobots} onCheckedChange={(value) => setScrapeForm((current) => ({ ...current, respectRobots: value }))} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <Label className="text-gray-600">Delay between requests (ms)</Label>
                <Input
                  type="number"
                  min={0}
                  max={10000}
                  className="mt-1 border-[var(--ink-line)] bg-[#f4f0e6]"
                  value={scrapeForm.delayMs}
                  onChange={(event) => setScrapeForm((current) => ({ ...current, delayMs: Number(event.target.value) || 0 }))}
                />
              </div>
              <div className="flex items-end">
                <div className="flex w-full items-center justify-between rounded border border-[var(--ink-line)] bg-[#f4f0e6] p-2">
                  <span className="text-xs text-gray-600">Enable proxy provider</span>
                  <Switch checked={scrapeForm.proxyEnabled} onCheckedChange={(value) => setScrapeForm((current) => ({ ...current, proxyEnabled: value }))} />
                </div>
              </div>
              <div>
                <Label className="text-gray-600">Proxy provider</Label>
                <Select value={scrapeForm.proxyProvider} onValueChange={(value) => setScrapeForm((current) => ({ ...current, proxyProvider: value }))}>
                  <SelectTrigger className="mt-1 border-[var(--ink-line)] bg-[#f4f0e6]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="scrapingbee">ScrapingBee</SelectItem>
                    <SelectItem value="proxy_template">Proxy template URL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {scrapeForm.proxyEnabled && scrapeForm.proxyProvider === "proxy_template" && (
              <div>
                <Label className="text-gray-600">Proxy template URL</Label>
                <Input
                  className="mt-1 border-[var(--ink-line)] bg-[#f4f0e6]"
                  placeholder="https://my-proxy.example.com?url={url}"
                  value={scrapeForm.proxyUrlTemplate}
                  onChange={(event) => setScrapeForm((current) => ({ ...current, proxyUrlTemplate: event.target.value }))}
                />
                <p className="mt-1 text-xs text-gray-500">Use <code>{"{url}"}</code> placeholder where the target URL should be injected.</p>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" className="border-[var(--ink-line)]" onClick={() => setShowScrapeDialog(false)}>Cancel</Button>
              <Button className="btn-gold" onClick={() => void onScrapeSubmit()} disabled={scraping}>
                {scraping ? "Starting..." : "Start Scrape"}
              </Button>
            </DialogFooter>

            <Separator />
            <div>
              <p className="mb-2 text-sm font-medium text-black">Recent scrape jobs</p>
              <div className="max-h-40 space-y-2 overflow-auto">
                {scrapeJobs.length === 0 ? (
                  <p className="text-xs text-gray-500">No jobs yet.</p>
                ) : scrapeJobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between gap-3 rounded border border-[var(--ink-line)] bg-[#f4f0e6] p-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs text-black">{job.sourceUrl}</p>
                      <p className="text-[11px] text-gray-500">{new Date(job.createdAt).toLocaleString()}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        job.status === "completed" && "border-emerald-500 text-emerald-600",
                        job.status === "running" && "border-[#18b897] text-[#127c66]",
                        job.status === "failed" && "border-red-500 text-red-600",
                      )}
                    >
                      {job.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CreateLinearIssueDialog
        open={showLinearIssueDialog}
        onOpenChange={setShowLinearIssueDialog}
        prefillTitle={linearIssuePrefill.title}
        prefillDescription={linearIssuePrefill.description}
      />

      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onNavigate={onNavigate}
        onAddLead={onAddLead}
        onUploadCSV={onUploadCSV}
      />
    </>
  )
}
