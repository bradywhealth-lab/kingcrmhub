"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  LayoutDashboard, Users, GitBranch, Brain, Share2, Settings,
  Menu, X, Bell, Search, Plus, TrendingUp, TrendingDown,
  Target, DollarSign, Activity, Zap, Calendar, Mail, Phone,
  MessageSquare, ChevronRight, Star, Clock, CheckCircle2,
  AlertCircle, BarChart3, PieChart, ArrowUpRight, Filter,
  MoreHorizontal, Edit, Trash2, Eye, Sparkles, RefreshCw,
  Send, FileText, ImageIcon, Video, Globe, Linkedin, Twitter,
  Facebook, Instagram, Play, Pause, ExternalLink,
  Moon, Sun, LogOut, User, Building2, Shield, Key, Webhook,
  Database, Server, Cpu, HardDrive, Wifi, Check, XCircle,
  Upload, Download, Layers, Tag, UserPlus, Bot, Wand2,
  FileSpreadsheet, AlertTriangle, Info, FileUp, History,
  ListFilter, SlidersHorizontal, Grid, List, ChevronDown,
  SquareKanban, Circle, Link2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { useAppStore, type Lead, type PipelineItem, type PipelineStage, type Activity as ActivityType, type AIInsight } from "@/lib/store"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell, LineChart, Line } from "recharts"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AppShell } from "@/components/app/app-shell"
import { WorkspaceOverlays } from "@/components/app/workspace-overlays"
import { useWorkspaceOverlays } from "@/components/app/use-workspace-overlays"
import { useWorkspaceSession } from "@/components/app/use-workspace-session"
import { SettingsView } from "@/components/settings/settings-view"
import { AiAssistantView } from "@/components/ai/ai-assistant-view"
import { triggerWinCelebration, triggerSmallCelebration } from "@/lib/celebrations"
import { toast } from "@/hooks/use-toast"
import { buildApiPath, readApiJsonOrText } from "@/lib/api-client"

// ============================================
// KING CRM HUB - ELITE DASHBOARD
// Cream background with cobalt accents
// Matching landing page aesthetic
// ============================================

// Mock Data - fixed ISO dates to avoid hydration mismatch
const _base = "2026-03-11T22:00:00.000Z"
const _yesterday = "2026-03-10T22:00:00.000Z"
const mockLeads: Lead[] = [
  { id: "1", firstName: "Sarah", lastName: "Johnson", email: "sarah@techcorp.com", phone: "(555) 123-4567", company: "TechCorp Inc", title: "CTO", source: "linkedin", status: "qualified", aiScore: 92, aiConfidence: 0.89, aiInsights: { intent: "high", budget: "confirmed" }, aiNextAction: "Schedule demo call", estimatedValue: 50000, lastContactedAt: _base, createdAt: _base, tags: [{ id: "1", name: "Hot Lead", color: "#2563EB" }] },
  { id: "2", firstName: "Michael", lastName: "Chen", email: "mchen@startup.io", phone: "(555) 234-5678", company: "Startup.io", title: "Founder", source: "referral", status: "new", aiScore: 78, aiConfidence: 0.75, aiInsights: { intent: "medium" }, aiNextAction: "Send introductory email", estimatedValue: 25000, lastContactedAt: null, createdAt: _base, tags: [] },
  { id: "3", firstName: "Emily", lastName: "Davis", email: "emily@enterprise.com", phone: "(555) 345-6789", company: "Enterprise Solutions", title: "VP of Sales", source: "website", status: "proposal", aiScore: 85, aiConfidence: 0.82, aiInsights: { intent: "high", timeline: "Q1" }, aiNextAction: "Follow up on proposal", estimatedValue: 75000, lastContactedAt: _yesterday, createdAt: _base, tags: [{ id: "2", name: "Enterprise", color: "#0F172A" }] },
  { id: "4", firstName: "James", lastName: "Wilson", email: "jwilson@agency.co", phone: "(555) 456-7890", company: "Creative Agency", title: "Director", source: "google", status: "negotiation", aiScore: 88, aiConfidence: 0.91, aiInsights: { intent: "high", decisionMaker: true }, aiNextAction: "Send contract", estimatedValue: 120000, lastContactedAt: _base, createdAt: _base, tags: [] },
  { id: "5", firstName: "Lisa", lastName: "Anderson", email: "lisa@retail.com", phone: "(555) 567-8901", company: "Retail Giants", title: "CEO", source: "referral", status: "new", aiScore: 65, aiConfidence: 0.68, aiInsights: {}, aiNextAction: "Research company needs", estimatedValue: 30000, lastContactedAt: null, createdAt: _base, tags: [] },
]

const _p1Close = "2026-04-10T22:00:00.000Z"
const _p2Close = "2026-05-10T22:00:00.000Z"
const _p3Close = "2026-03-25T22:00:00.000Z"
const _p4Close = "2026-03-30T22:00:00.000Z"
const _p5Close = "2026-03-22T22:00:00.000Z"
const mockPipelineStages = [
  { id: "new", name: "New", color: "#0F172A", order: 0, items: [
    { id: "p1", title: "Michael Chen - Startup.io", value: 25000, probability: 20, stageId: "new", leadId: "2", lead: mockLeads[1], aiWinProbability: 0.35, expectedClose: _p1Close },
    { id: "p2", title: "Lisa Anderson - Retail Giants", value: 30000, probability: 15, stageId: "new", leadId: "5", lead: mockLeads[4], aiWinProbability: 0.28, expectedClose: _p2Close },
  ]},
  { id: "contacted", name: "Contacted", color: "#6B7280", order: 1, items: [] },
  { id: "qualified", name: "Qualified", color: "#2563EB", order: 2, items: [
    { id: "p3", title: "Sarah Johnson - TechCorp", value: 50000, probability: 60, stageId: "qualified", leadId: "1", lead: mockLeads[0], aiWinProbability: 0.72, expectedClose: _p3Close },
  ]},
  { id: "proposal", name: "Proposal", color: "#0284C7", order: 3, items: [
    { id: "p4", title: "Emily Davis - Enterprise", value: 75000, probability: 70, stageId: "proposal", leadId: "3", lead: mockLeads[2], aiWinProbability: 0.68, expectedClose: _p4Close },
  ]},
  { id: "negotiation", name: "Negotiation", color: "#64748B", order: 4, items: [
    { id: "p5", title: "James Wilson - Agency", value: 120000, probability: 85, stageId: "negotiation", leadId: "4", lead: mockLeads[3], aiWinProbability: 0.89, expectedClose: _p5Close },
  ]},
  { id: "won", name: "Won", color: "#059669", order: 5, items: [] },
]

// Fixed ISO timestamps to avoid hydration mismatch (no Date.now() at module load)
const _now = "2026-03-11T22:00:00.000Z"
const mockActivities: ActivityType[] = [
  { id: "1", type: "email", title: "Sent proposal to Sarah Johnson", description: "Follow-up email with pricing", metadata: { opened: true }, aiSummary: "Lead showed interest in premium plan", createdAt: _now, lead: mockLeads[0] },
  { id: "2", type: "call", title: "Discovery call with James Wilson", description: "Discussed requirements and timeline", metadata: { duration: 45 }, aiSummary: "Decision maker engaged, ready for proposal", createdAt: "2026-03-11T21:00:00.000Z", lead: mockLeads[3] },
  { id: "3", type: "ai_analysis", title: "AI scored new lead", description: "Michael Chen scored 78/100", metadata: { score: 78 }, aiSummary: "High potential - immediate follow-up recommended", createdAt: "2026-03-11T20:00:00.000Z", lead: mockLeads[1] },
  { id: "4", type: "meeting", title: "Demo scheduled", description: "Product demo with Enterprise Solutions", metadata: {}, aiSummary: null, createdAt: "2026-03-10T22:00:00.000Z", lead: mockLeads[2] },
]

const mockInsights: AIInsight[] = [
  { id: "1", type: "prediction", category: "pipeline", title: "Revenue Forecast", description: "Based on current pipeline velocity, you're projected to close $280K this quarter", data: { confidence: 0.82 }, confidence: 0.82, actionable: true, dismissed: false },
  { id: "2", type: "recommendation", category: "leads", title: "Follow-up Alert", description: "3 leads haven't been contacted in 7+ days. Immediate outreach recommended.", data: { leads: ["2", "5"] }, confidence: 0.95, actionable: true, dismissed: false },
  { id: "3", type: "trend", category: "performance", title: "Conversion Rate Up", description: "Your lead-to-opportunity conversion increased 12% this month", data: { change: 0.12 }, confidence: 0.88, actionable: false, dismissed: false },
  { id: "4", type: "alert", category: "pipeline", title: "Deal at Risk", description: "James Wilson deal hasn't had activity in 5 days. Consider reaching out.", data: { dealId: "p5" }, confidence: 0.76, actionable: true, dismissed: false },
]

const chartData = [
  { month: "Jan", leads: 45, won: 12, revenue: 85000 },
  { month: "Feb", leads: 52, won: 18, revenue: 120000 },
  { month: "Mar", leads: 48, won: 15, revenue: 95000 },
  { month: "Apr", leads: 61, won: 22, revenue: 145000 },
  { month: "May", leads: 55, won: 19, revenue: 130000 },
  { month: "Jun", leads: 67, won: 28, revenue: 180000 },
]

const sourceData = [
  { name: "LinkedIn", value: 35, color: "#2563EB" },
  { name: "Referral", value: 28, color: "#0F172A" },
  { name: "Website", value: 20, color: "#0EA5E9" },
  { name: "Google", value: 12, color: "#14B8A6" },
  { name: "Other", value: 5, color: "#64748B" },
]

const chartConfig: ChartConfig = {
  leads: { label: "Leads", color: "#2563EB" },
  won: { label: "Won", color: "#0F172A" },
  revenue: { label: "Revenue", color: "#0EA5E9" },
}

type DashboardStats = {
  totalLeads: number
  newLeadsToday: number
  pipelineValue: number
  wonThisMonth: number
  avgLeadScore: number
  activitiesToday: number
  sourceBreakdown: Array<{ name: string; value: number }>
  leadTrend: Array<{ date: string; leads: number }>
}

type DashboardInsight = AIInsight & {
  createdAt?: string
}

function normalizeLead(raw: Record<string, unknown>): Lead {
  return {
    id: String(raw.id),
    firstName: typeof raw.firstName === "string" ? raw.firstName : null,
    lastName: typeof raw.lastName === "string" ? raw.lastName : null,
    email: typeof raw.email === "string" ? raw.email : null,
    phone: typeof raw.phone === "string" ? raw.phone : null,
    company: typeof raw.company === "string" ? raw.company : null,
    title: typeof raw.title === "string" ? raw.title : null,
    source: typeof raw.source === "string" ? raw.source : null,
    status: typeof raw.status === "string" ? raw.status : "new",
    aiScore: Number(raw.aiScore) || 0,
    aiConfidence: raw.aiConfidence != null ? Number(raw.aiConfidence) : null,
    aiInsights: raw.aiInsights && typeof raw.aiInsights === "object" && !Array.isArray(raw.aiInsights)
      ? raw.aiInsights as Record<string, unknown>
      : null,
    aiNextAction: typeof raw.aiNextAction === "string" ? raw.aiNextAction : null,
    estimatedValue: raw.estimatedValue != null ? Number(raw.estimatedValue) : null,
    lastContactedAt: typeof raw.lastContactedAt === "string" ? raw.lastContactedAt : null,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
    tags: Array.isArray(raw.tags) ? raw.tags as { id: string; name: string; color: string }[] : [],
  }
}

function normalizePipelineStages(rawStages: unknown): PipelineStage[] {
  if (!Array.isArray(rawStages)) return []
  return rawStages.map((stage, stageIndex) => {
    const stageRecord = stage as Record<string, unknown>
    return {
      id: String(stageRecord.id),
      name: typeof stageRecord.name === "string" ? stageRecord.name : `Stage ${stageIndex + 1}`,
      color: typeof stageRecord.color === "string" ? stageRecord.color : "#2563EB",
      order: typeof stageRecord.order === "number" ? stageRecord.order : stageIndex,
      items: Array.isArray(stageRecord.items)
        ? (stageRecord.items as Record<string, unknown>[]).map((item) => ({
            id: String(item.id),
            title: typeof item.title === "string" ? item.title : "Untitled deal",
            value: item.value != null ? Number(item.value) : null,
            probability: item.probability != null ? Number(item.probability) : null,
            stageId: typeof item.stageId === "string" ? item.stageId : String(stageRecord.id),
            leadId: typeof item.leadId === "string" ? item.leadId : null,
            lead: item.lead && typeof item.lead === "object" ? normalizeLead(item.lead as Record<string, unknown>) : null,
            aiWinProbability: item.aiWinProbability != null ? Number(item.aiWinProbability) : null,
            expectedClose: typeof item.expectedClose === "string" ? item.expectedClose : null,
          }))
        : [],
    }
  })
}

function formatLeadTrend(data: DashboardStats["leadTrend"] | undefined) {
  if (!Array.isArray(data) || data.length === 0) return chartData
  return data.map((point) => ({
    month: new Date(point.date).toLocaleDateString([], { month: "short", day: "numeric" }),
    leads: point.leads,
    won: 0,
    revenue: 0,
  }))
}

function formatSourceBreakdown(data: DashboardStats["sourceBreakdown"] | undefined) {
  const palette = ["#2563EB", "#0F172A", "#0EA5E9", "#14B8A6", "#64748B", "#0284C7"]
  if (!Array.isArray(data) || data.length === 0) return sourceData
  return data.map((entry, index) => ({
    name: entry.name,
    value: entry.value,
    color: palette[index % palette.length],
  }))
}

function getActivityVisual(type: string) {
  if (type === "email") return { icon: Mail, className: "bg-blue-100 text-blue-600" }
  if (type === "call" || type === "sms") return { icon: Phone, className: "bg-emerald-100 text-emerald-600" }
  if (type === "meeting") return { icon: Calendar, className: "bg-purple-100 text-purple-600" }
  if (type.startsWith("ai")) return { icon: Brain, className: "bg-[#2563EB]/20 text-[#2563EB]" }
  return { icon: Activity, className: "bg-gray-100 text-gray-600" }
}

// Utility Components
function AnimatedNumber({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0)
  
  useEffect(() => {
    const duration = 500
    const steps = 20
    const stepValue = value / steps
    let current = 0
    let step = 0
    const timer = setInterval(() => {
      step++
      current = Math.min(step * stepValue, value)
      if (step >= steps) {
        setDisplayValue(value)
        clearInterval(timer)
      } else {
        setDisplayValue(Math.floor(current))
      }
    }, duration / steps)
    return () => clearInterval(timer)
  }, [value])
  
  return <span>{prefix}{displayValue.toLocaleString()}{suffix}</span>
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? "bg-gradient-to-r from-[#2563EB] to-[#14B8A6] text-black" : 
                score >= 60 ? "bg-[#0EA5E9] text-white" : "bg-[#0F172A] text-white"
  return (
    <div className={cn("px-2 py-0.5 rounded text-xs font-semibold", color)}>
      {score}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    new: "bg-[#0F172A] text-white",
    contacted: "bg-gray-600 text-white",
    qualified: "bg-[#2563EB] text-black",
    proposal: "bg-blue-600 text-white",
    negotiation: "bg-[#64748B] text-white",
    won: "bg-emerald-600 text-white",
    lost: "bg-red-600 text-white",
  }
  return (
    <span className={cn("px-2 py-0.5 rounded text-xs font-medium capitalize", styles[status] || "bg-gray-500 text-white")}>
      {status}
    </span>
  )
}

// Dashboard View
function DashboardView() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [insights, setInsights] = useState<DashboardInsight[]>([])
  const [activities, setActivities] = useState<ActivityType[]>([])
  const [myDay, setMyDay] = useState<{
    summary: string
    leadsToCall: { id: string; name: string; company?: string | null; aiScore: number; reason: string }[]
    meetings: { id: string; title: string; time: string; lead: { name: string } | null }[]
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const [statsRes, insightsRes, activitiesRes, myDayRes] = await Promise.all([
          fetch('/api/stats'),
          fetch('/api/ai/insights?limit=4'),
          fetch('/api/activities?limit=5'),
          fetch('/api/ai/my-day?limit=5'),
        ])

        const [statsData, insightsData, activitiesData, myDayData] = await Promise.all([
          statsRes.json(),
          insightsRes.json(),
          activitiesRes.json(),
          myDayRes.json(),
        ])

        if (cancelled) return

        if (!statsData.error) setStats(statsData)
        if (!insightsData.error) setInsights(Array.isArray(insightsData.insights) ? insightsData.insights : [])
        if (!activitiesData.error) {
          setActivities(Array.isArray(activitiesData.activities) ? activitiesData.activities : [])
        }
        if (!myDayData.error) setMyDay(myDayData)
      } catch {
        // fall back to local defaults below
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const statCards = [
    {
      title: "Total Leads",
      value: stats?.totalLeads ?? 0,
      icon: Users,
      color: "gold" as const,
      detail: `${stats?.newLeadsToday ?? 0} new today`,
    },
    {
      title: "Pipeline Value",
      value: stats?.pipelineValue ?? 0,
      icon: DollarSign,
      color: "black" as const,
      prefix: "$",
      detail: `${stats?.activitiesToday ?? 0} activities today`,
    },
    {
      title: "Avg Lead Score",
      value: stats?.avgLeadScore ?? 0,
      icon: Target,
      color: "gold" as const,
      detail: `${insights.length} live insights`,
    },
    {
      title: "Won This Month",
      value: stats?.wonThisMonth ?? 0,
      icon: CheckCircle2,
      color: "emerald" as const,
      detail: loading ? "Loading…" : "Live from pipeline",
    },
  ]

  const liveTrend = formatLeadTrend(stats?.leadTrend)
  const liveSources = formatSourceBreakdown(stats?.sourceBreakdown)
  const visibleInsights = insights.length > 0 ? insights.filter((i) => !i.dismissed).slice(0, 4) : mockInsights.slice(0, 4)
  const visibleActivities = activities.length > 0 ? activities.slice(0, 5) : mockActivities.slice(0, 5)

  return (
    <div className="p-6 space-y-6 bg-[#fcf8ec] min-h-screen">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="bg-[#fcfcfc] border-[rgba(31,42,54,0.08)] shadow-sm hover:shadow-md transition-shadow card-hover">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.title}</p>
                  <p className="text-2xl font-bold text-black mt-1">
                    <AnimatedNumber value={stat.value} prefix={stat.prefix} />
                  </p>
                </div>
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  stat.color === "gold" && "bg-[#2563EB]/20",
                  stat.color === "black" && "bg-[#0F172A]",
                  stat.color === "emerald" && "bg-emerald-100",
                )}>
                  <stat.icon className={cn(
                    "w-5 h-5",
                    stat.color === "gold" && "text-[#2563EB]",
                    stat.color === "black" && "text-white",
                    stat.color === "emerald" && "text-emerald-600",
                  )} />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span>{stat.detail}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2 bg-[#fcfcfc] border-[rgba(31,42,54,0.08)] shadow-sm">
          <CardHeader>
            <CardTitle className="text-black">Revenue & Leads</CardTitle>
            <CardDescription className="text-gray-500">Monthly performance overview</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[280px]">
              <AreaChart data={liveTrend}>
                <defs>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorWon" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0F172A" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#0F172A" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#D7DFEA" />
                <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="leads" stroke="#2563EB" fillOpacity={1} fill="url(#colorLeads)" strokeWidth={2} />
                <Area type="monotone" dataKey="won" stroke="#0F172A" fillOpacity={1} fill="url(#colorWon)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
        
        {/* Lead Sources */}
        <Card className="bg-[#fcfcfc] border-[rgba(31,42,54,0.08)] shadow-sm">
          <CardHeader>
            <CardTitle className="text-black">Lead Sources</CardTitle>
            <CardDescription className="text-gray-500">Distribution by channel</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={liveSources}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {liveSources.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-4">
              {liveSources.map((source) => (
                <div key={source.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: source.color }} />
                    <span className="text-sm text-gray-600">{source.name}</span>
                  </div>
                  <span className="text-sm font-medium text-black">{source.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* AI Insights & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Insights */}
        <Card className="bg-[#fcfcfc] border-[rgba(31,42,54,0.08)] shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#2563EB]" />
              <CardTitle className="text-black">AI Insights</CardTitle>
            </div>
            <CardDescription className="text-gray-500">Smart recommendations powered by AI</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {visibleInsights.map((insight) => (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "p-3 rounded-lg border",
                  insight.type === "prediction" && "bg-[#2563EB]/5 border-[#2563EB]/30",
                  insight.type === "recommendation" && "bg-blue-50 border-blue-200",
                  insight.type === "trend" && "bg-emerald-50 border-emerald-200",
                  insight.type === "alert" && "bg-amber-50 border-amber-200",
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-xs font-medium uppercase",
                        insight.type === "prediction" && "text-[#2563EB]",
                        insight.type === "recommendation" && "text-blue-600",
                        insight.type === "trend" && "text-emerald-600",
                        insight.type === "alert" && "text-amber-600",
                      )}>
                        {insight.type}
                      </span>
                      {insight.confidence && (
                        <Badge variant="outline" className="text-xs border-gray-300 text-gray-600">
                          {Math.round(insight.confidence * 100)}% confidence
                        </Badge>
                      )}
                    </div>
                    <h4 className="text-sm font-medium text-black mt-1">{insight.title}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">{insight.description}</p>
                  </div>
                  {insight.actionable && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[#2563EB] hover:bg-[#2563EB]/10 h-7 px-2"
                      onClick={() =>
                        toast({
                          title: insight.title,
                          description: 'Open the relevant lead, pipeline, or task workflow from this insight card.',
                        })
                      }
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
        
        {/* Recent Activity */}
        <Card className="bg-[#fcfcfc] border-[rgba(31,42,54,0.08)] shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#2563EB]" />
              <CardTitle className="text-black">Recent Activity</CardTitle>
            </div>
            <CardDescription className="text-gray-500">Latest actions and updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {visibleActivities.map((activity) => {
                const visual = getActivityVisual(activity.type)
                return (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", visual.className)}>
                    <visual.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-black truncate">{activity.title}</p>
                    <p className="text-xs text-gray-500 truncate">{activity.description}</p>
                    <p className="text-xs text-gray-400 mt-1" suppressHydrationWarning>
                      {new Date(activity.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )})}
            </div>
          </CardContent>
        </Card>
      </div>

      {myDay && (
        <Card className="bg-[#fcfcfc] border-[rgba(31,42,54,0.08)] shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-[#2563EB]" />
              <CardTitle className="text-black">AI Daily Assistant</CardTitle>
            </div>
            <CardDescription className="text-gray-500">{myDay.summary}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold text-black mb-3">Priority Leads to Call</h4>
              <div className="space-y-2">
                {myDay.leadsToCall.slice(0, 5).map((lead) => (
                  <div key={lead.id} className="p-3 bg-[#EEF2F7] rounded-lg border border-[rgba(31,42,54,0.08)]">
                    <p className="text-sm font-medium text-black">{lead.name}</p>
                    <p className="text-xs text-gray-500">{lead.company || 'Unknown company'}</p>
                    <div className="flex items-center justify-between mt-2">
                      <ScoreBadge score={lead.aiScore} />
                      <span className="text-xs text-gray-500">{lead.reason}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-black mb-3">Upcoming Meetings</h4>
              <div className="space-y-2">
                {myDay.meetings.length === 0 ? (
                  <div className="p-3 bg-[#EEF2F7] rounded-lg border border-[rgba(31,42,54,0.08)] text-sm text-gray-500">
                    No meetings queued yet.
                  </div>
                ) : myDay.meetings.slice(0, 5).map((meeting) => (
                  <div key={meeting.id} className="p-3 bg-[#EEF2F7] rounded-lg border border-[rgba(31,42,54,0.08)]">
                    <p className="text-sm font-medium text-black">{meeting.title}</p>
                    <p className="text-xs text-gray-500">{meeting.lead?.name || 'Unassigned lead'}</p>
                    <p className="text-xs text-gray-500 mt-1">{new Date(meeting.time).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Leads View with CSV Upload - fetches real data from API
function LeadsView({ onAddLead, onUploadCSV, onScrape, refreshKey = 0 }: { onAddLead: () => void; onUploadCSV: () => void; onScrape: () => void; refreshKey?: number }) {
  type CarrierPlaybook = {
    recommendedCarrier: {
      id: string | null
      name: string
      rationale: string
      confidence: number
    }
    backupCarriers: Array<{
      id: string | null
      name: string
      rationale: string
    }>
    suggestedPlanType: string
    qualificationSummary: string[]
    objectionHandling: string[]
    followUpScripts: {
      callOpening: string
      sms: string
      emailSubject: string
      emailBody: string
    }
    nextActions: string[]
    citations: Array<{
      carrierId: string | null
      carrierName: string
      documentId: string
      documentName: string
      chunkIndex: number
      snippet: string
    }>
  }

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [showEditLeadDialog, setShowEditLeadDialog] = useState(false)
  const [showContactLeadDialog, setShowContactLeadDialog] = useState(false)
  const [editLeadForm, setEditLeadForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    title: '',
    source: 'manual',
    status: 'new',
    estimatedValue: '',
    aiNextAction: '',
  })
  const [contactMessage, setContactMessage] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("score")
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assistantLoading, setAssistantLoading] = useState(false)
  const [assistantSaving, setAssistantSaving] = useState(false)
  const [assistantPlaybook, setAssistantPlaybook] = useState<CarrierPlaybook | null>(null)
  const [assistantSource, setAssistantSource] = useState<'llm' | 'fallback' | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch("/api/leads?limit=200")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        const list = (data.leads || []).map((l: Record<string, unknown>) => ({
          id: l.id,
          firstName: l.firstName ?? null,
          lastName: l.lastName ?? null,
          email: l.email ?? null,
          phone: l.phone ?? null,
          company: l.company ?? null,
          title: l.title ?? null,
          source: l.source ?? null,
          status: (l.status as string) || "new",
          aiScore: Number(l.aiScore) ?? 0,
          aiConfidence: l.aiConfidence != null ? Number(l.aiConfidence) : null,
          aiInsights: (l.aiInsights as Record<string, unknown>) ?? null,
          aiNextAction: (l.aiNextAction as string) ?? null,
          estimatedValue: l.estimatedValue != null ? Number(l.estimatedValue) : null,
          lastContactedAt: l.lastContactedAt ? String(l.lastContactedAt) : null,
          createdAt: l.createdAt ? String(l.createdAt) : new Date().toISOString(),
          tags: Array.isArray(l.tags) ? l.tags as { id: string; name: string; color: string }[] : [],
        }))
        setLeads(list)
      })
      .catch((e) => setError(e.message || "Failed to load leads"))
      .finally(() => setLoading(false))
  }, [refreshKey])

  const refreshLeads = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/leads?limit=200')
      const data = await r.json()
      if (data.error) throw new Error(data.error)
      const list = (data.leads || []).map((l: Record<string, unknown>) => ({
        id: l.id,
        firstName: l.firstName ?? null,
        lastName: l.lastName ?? null,
        email: l.email ?? null,
        phone: l.phone ?? null,
        company: l.company ?? null,
        title: l.title ?? null,
        source: l.source ?? null,
        status: (l.status as string) || "new",
        aiScore: Number(l.aiScore) ?? 0,
        aiConfidence: l.aiConfidence != null ? Number(l.aiConfidence) : null,
        aiInsights: (l.aiInsights as Record<string, unknown>) ?? null,
        aiNextAction: (l.aiNextAction as string) ?? null,
        estimatedValue: l.estimatedValue != null ? Number(l.estimatedValue) : null,
        lastContactedAt: l.lastContactedAt ? String(l.lastContactedAt) : null,
        createdAt: l.createdAt ? String(l.createdAt) : new Date().toISOString(),
        tags: Array.isArray(l.tags) ? l.tags as { id: string; name: string; color: string }[] : [],
      }))
      setLeads(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to refresh leads')
    } finally {
      setLoading(false)
    }
  }

  const rescoreLead = async (leadId: string) => {
    try {
      const res = await fetch(`/api/ai/score?leadId=${leadId}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: 'Lead rescored', description: `New AI score: ${data.aiScore}` })
      await refreshLeads()
    } catch (error) {
      toast({
        title: 'Rescore failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const markOutcome = async (leadId: string, status: 'won' | 'lost') => {
    try {
      const patchRes = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const patchData = await patchRes.json()
      if (patchData.error) throw new Error(patchData.error)

      await fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'lead_outcome',
          entityId: leadId,
          rating: status === 'won' ? 1 : -1,
          feedback: `Lead marked as ${status}`,
        }),
      })

      toast({ title: 'Outcome saved', description: `Lead marked as ${status}.` })
      await refreshLeads()
    } catch (error) {
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const generateCarrierPlaybook = async (leadId: string) => {
    try {
      setAssistantLoading(true)
      const res = await fetch('/api/ai/carrier-playbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAssistantPlaybook(data.playbook || null)
      setAssistantSource((data.source as 'llm' | 'fallback') || null)
      toast({
        title: 'AI playbook generated',
        description: data.source === 'fallback'
          ? 'Generated from rule-based fallback because LLM output was unavailable.'
          : 'Carrier recommendation and scripts are ready.',
      })
    } catch (playbookError) {
      toast({
        title: 'Playbook generation failed',
        description: playbookError instanceof Error ? playbookError.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setAssistantLoading(false)
    }
  }

  const savePlaybookToTimeline = async (leadId: string) => {
    if (!assistantPlaybook) return
    try {
      setAssistantSaving(true)
      const res = await fetch('/api/ai/carrier-playbook/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          source: assistantSource || 'manual',
          playbook: assistantPlaybook,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({
        title: 'Playbook saved',
        description: 'AI playbook was saved to the lead timeline.',
      })
    } catch (saveError) {
      toast({
        title: 'Save failed',
        description: saveError instanceof Error ? saveError.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setAssistantSaving(false)
    }
  }

  const filteredLeads = leads
    .filter(lead => filterStatus === "all" || lead.status === filterStatus)
    .sort((a, b) => {
      if (sortBy === "score") return b.aiScore - a.aiScore
      if (sortBy === "value") return (b.estimatedValue || 0) - (a.estimatedValue || 0)
      if (sortBy === "date") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      return 0
    })

  const openEditLead = () => {
    if (!selectedLead) return
    setEditLeadForm({
      firstName: selectedLead.firstName || '',
      lastName: selectedLead.lastName || '',
      email: selectedLead.email || '',
      phone: selectedLead.phone || '',
      company: selectedLead.company || '',
      title: selectedLead.title || '',
      source: selectedLead.source || 'manual',
      status: selectedLead.status,
      estimatedValue: selectedLead.estimatedValue != null ? String(selectedLead.estimatedValue) : '',
      aiNextAction: selectedLead.aiNextAction || '',
    })
    setShowEditLeadDialog(true)
  }

  const saveLeadEdits = async () => {
    if (!selectedLead) return
    try {
      const res = await fetch(`/api/leads/${selectedLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editLeadForm,
          estimatedValue: editLeadForm.estimatedValue ? Number(editLeadForm.estimatedValue) : null,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: 'Lead updated', description: 'Lead details saved successfully.' })
      setShowEditLeadDialog(false)
      await refreshLeads()
    } catch (error) {
      toast({
        title: 'Lead update failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const openContactLead = () => {
    if (!selectedLead) return
    setContactMessage(selectedLead.aiNextAction ? `Hi ${selectedLead.firstName || ''}, ${selectedLead.aiNextAction}`.trim() : `Hi ${selectedLead.firstName || ''}, just following up from Insurafuze.`.trim())
    setShowContactLeadDialog(true)
  }

  const sendLeadMessage = async () => {
    if (!selectedLead) return
    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selectedLead.id,
          body: contactMessage,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: 'Lead contacted', description: data.message || 'Message recorded successfully.' })
      setShowContactLeadDialog(false)
      await refreshLeads()
    } catch (error) {
      toast({
        title: 'Failed to contact lead',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="p-6 space-y-6 bg-[#fcf8ec] min-h-screen">
      {/* Header with Add new lead + Import CSV on tab */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black">Leads</h1>
          <p className="text-gray-500">AI-powered lead management with smart scoring</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="border-[#0F172A] text-[#0F172A] hover:bg-[#EEF2F7] gap-2"
            onClick={onScrape}
          >
            <Globe className="w-4 h-4" />
            Scrape Leads
          </Button>
          <Button 
            variant="outline" 
            className="border-[#2563EB] text-[#2563EB] hover:bg-[#2563EB]/10 gap-2"
            onClick={onUploadCSV}
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </Button>
          <Button className="btn-gold gap-2" onClick={onAddLead}>
            <Plus className="w-4 h-4" />
            Add new lead
          </Button>
        </div>
      </div>
      
      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px] bg-[#fcfcfc] border-[rgba(31,42,54,0.08)]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent className="bg-[#fcfcfc] border-[rgba(31,42,54,0.08)]">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="qualified">Qualified</SelectItem>
              <SelectItem value="proposal">Proposal</SelectItem>
              <SelectItem value="negotiation">Negotiation</SelectItem>
              <SelectItem value="won">Won</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[140px] bg-[#fcfcfc] border-[rgba(31,42,54,0.08)]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent className="bg-[#fcfcfc] border-[rgba(31,42,54,0.08)]">
            <SelectItem value="score">AI Score</SelectItem>
            <SelectItem value="value">Value</SelectItem>
            <SelectItem value="date">Date Added</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Leads Table */}
      <Card className="bg-[#fcfcfc] border-[rgba(31,42,54,0.08)] shadow-sm overflow-hidden">
        {error && (
          <div className="p-4 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm">{error}</div>
        )}
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading leads...</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[rgba(31,42,54,0.08)] bg-[#EEF2F7]">
                <th className="text-left p-4 text-sm font-medium text-gray-600">Contact</th>
                <th className="text-left p-4 text-sm font-medium text-gray-600">Company</th>
                <th className="text-left p-4 text-sm font-medium text-gray-600">Source</th>
                <th className="text-left p-4 text-sm font-medium text-gray-600">Status</th>
                <th className="text-left p-4 text-sm font-medium text-gray-600">AI Score</th>
                <th className="text-left p-4 text-sm font-medium text-gray-600">Value</th>
                <th className="text-left p-4 text-sm font-medium text-gray-600">Next Action</th>
                <th className="text-left p-4 text-sm font-medium text-gray-600"></th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-500">No leads yet. Add one or import a CSV.</td></tr>
              ) : filteredLeads.map((lead) => (
                <motion.tr
                  key={lead.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-b border-[rgba(31,42,54,0.08)] hover:bg-[#fcf8ec] transition-colors cursor-pointer"
                  onClick={() => setSelectedLead(lead)}
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-9 h-9">
                        <AvatarFallback className="bg-[#2563EB] text-black text-sm font-medium">
                          {lead.firstName?.[0]}{lead.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-black">{lead.firstName} {lead.lastName}</p>
                        <p className="text-xs text-gray-500">{lead.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <p className="text-sm text-black">{lead.company}</p>
                    <p className="text-xs text-gray-500">{lead.title}</p>
                  </td>
                  <td className="p-4">
                    <Badge variant="outline" className="capitalize border-[rgba(31,42,54,0.08)] text-gray-600">
                      {lead.source}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <StatusBadge status={lead.status} />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <ScoreBadge score={lead.aiScore} />
                      {lead.aiConfidence && (
                        <span className="text-xs text-gray-400">{Math.round(lead.aiConfidence * 100)}%</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-black font-medium">
                      ${lead.estimatedValue?.toLocaleString() || '-'}
                    </span>
                  </td>
                  <td className="p-4">
                    <p className="text-sm text-gray-600 max-w-[200px] truncate">{lead.aiNextAction}</p>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#2563EB] hover:bg-[#2563EB]/10"
                        onClick={(e) => {
                          e.stopPropagation()
                          void rescoreLead(lead.id)
                        }}
                      >
                        Re-score
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-emerald-600 hover:bg-emerald-50"
                        onClick={(e) => {
                          e.stopPropagation()
                          void markOutcome(lead.id, 'won')
                        }}
                      >
                        Won
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation()
                          void markOutcome(lead.id, 'lost')
                        }}
                      >
                        Lost
                      </Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>
      
      {/* Lead Detail Modal */}
      <Dialog
        open={!!selectedLead}
        onOpenChange={() => {
          setSelectedLead(null)
          setAssistantPlaybook(null)
          setAssistantSource(null)
          setAssistantLoading(false)
          setAssistantSaving(false)
        }}
      >
        <DialogContent className="bg-[#fcfcfc] border-[rgba(31,42,54,0.08)] max-w-2xl">
          {selectedLead && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl text-black">Lead Details</DialogTitle>
                <DialogDescription className="text-gray-500">
                  AI-powered insights for {selectedLead.firstName} {selectedLead.lastName}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-2 gap-6 py-4">
                <div className="space-y-4">
                  <div>
                    <Label className="text-gray-500 text-xs">Email</Label>
                    <p className="text-black">{selectedLead.email}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500 text-xs">Phone</Label>
                    <p className="text-black">{selectedLead.phone}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500 text-xs">Company</Label>
                    <p className="text-black">{selectedLead.company}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500 text-xs">Title</Label>
                    <p className="text-black">{selectedLead.title}</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label className="text-gray-500 text-xs">AI Score</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <ScoreBadge score={selectedLead.aiScore} />
                      <Progress value={selectedLead.aiScore} className="flex-1 h-2" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-gray-500 text-xs">Estimated Value</Label>
                    <p className="text-black text-xl font-semibold">${selectedLead.estimatedValue?.toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500 text-xs">AI Recommended Action</Label>
                    <p className="text-[#2563EB]">{selectedLead.aiNextAction}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500 text-xs">Status</Label>
                    <div className="mt-1">
                      <StatusBadge status={selectedLead.status} />
                    </div>
                  </div>
                </div>
              </div>

              <Card className="bg-[#fcf8ec] border-[rgba(31,42,54,0.08)]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-black">
                    <Bot className="w-4 h-4 text-[#2563EB]" />
                    AI Carrier Assistant
                  </CardTitle>
                  <CardDescription>
                    Recommends carrier + plan strategy and generates follow-up scripts from lead context and your carrier library.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Button
                      className="btn-gold gap-2"
                      onClick={() => void generateCarrierPlaybook(selectedLead.id)}
                      disabled={assistantLoading}
                    >
                      {assistantLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Generate pitch playbook
                        </>
                      )}
                    </Button>
                    {assistantSource && (
                      <Badge variant="outline" className="border-[rgba(31,42,54,0.08)] text-gray-600 capitalize">
                        Source: {assistantSource}
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      className="border-[rgba(31,42,54,0.08)] text-gray-700 hover:bg-[#EEF2F7]"
                      disabled={!assistantPlaybook || assistantSaving}
                      onClick={() => void savePlaybookToTimeline(selectedLead.id)}
                    >
                      {assistantSaving ? 'Saving...' : 'Save to timeline'}
                    </Button>
                  </div>

                  {assistantPlaybook && (
                    <div className="space-y-4">
                      <div className="rounded-lg border border-[rgba(31,42,54,0.08)] bg-white p-4">
                        <p className="text-xs text-gray-500">Recommended Carrier</p>
                        <p className="text-sm font-semibold text-black mt-1">
                          {assistantPlaybook.recommendedCarrier.name}
                          <span className="text-xs text-gray-500 ml-2">
                            ({Math.round((assistantPlaybook.recommendedCarrier.confidence || 0) * 100)}% confidence)
                          </span>
                        </p>
                        <p className="text-sm text-gray-600 mt-2">{assistantPlaybook.recommendedCarrier.rationale}</p>
                        <p className="text-sm text-[#2563EB] mt-2">
                          Plan suggestion: {assistantPlaybook.suggestedPlanType}
                        </p>
                      </div>

                      {assistantPlaybook.backupCarriers?.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 mb-2">Backup Carriers</p>
                          <div className="space-y-2">
                            {assistantPlaybook.backupCarriers.map((carrier, idx) => (
                              <div key={`${carrier.name}-${idx}`} className="rounded-lg border border-[rgba(31,42,54,0.08)] bg-white p-3">
                                <p className="text-sm font-medium text-black">{carrier.name}</p>
                                <p className="text-xs text-gray-600 mt-1">{carrier.rationale}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="rounded-lg border border-[rgba(31,42,54,0.08)] bg-white p-3">
                          <p className="text-xs text-gray-500 mb-2">Qualification Summary</p>
                          <ul className="text-sm text-gray-700 space-y-1">
                            {assistantPlaybook.qualificationSummary.map((item, idx) => (
                              <li key={`qual-${idx}`}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-lg border border-[rgba(31,42,54,0.08)] bg-white p-3">
                          <p className="text-xs text-gray-500 mb-2">Objection Handling</p>
                          <ul className="text-sm text-gray-700 space-y-1">
                            {assistantPlaybook.objectionHandling.map((item, idx) => (
                              <li key={`obj-${idx}`}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="rounded-lg border border-[rgba(31,42,54,0.08)] bg-white p-3 space-y-2">
                        <p className="text-xs text-gray-500">Follow-up Scripts</p>
                        <p className="text-sm text-gray-700"><span className="font-medium text-black">Call opening:</span> {assistantPlaybook.followUpScripts.callOpening}</p>
                        <p className="text-sm text-gray-700"><span className="font-medium text-black">SMS:</span> {assistantPlaybook.followUpScripts.sms}</p>
                        <p className="text-sm text-gray-700"><span className="font-medium text-black">Email subject:</span> {assistantPlaybook.followUpScripts.emailSubject}</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap"><span className="font-medium text-black">Email body:</span> {assistantPlaybook.followUpScripts.emailBody}</p>
                      </div>

                      {assistantPlaybook.citations?.length > 0 && (
                        <div className="rounded-lg border border-[rgba(31,42,54,0.08)] bg-white p-3 space-y-2">
                          <p className="text-xs text-gray-500">Grounding Citations</p>
                          {assistantPlaybook.citations.slice(0, 4).map((c, idx) => (
                            <div key={`${c.documentId}-${c.chunkIndex}-${idx}`} className="rounded border border-[#E6EDF7] bg-[#fcf8ec] p-2">
                              <p className="text-xs font-medium text-black">
                                {c.carrierName} - {c.documentName} (chunk {c.chunkIndex})
                              </p>
                              <p className="text-xs text-gray-600 mt-1">{c.snippet}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  className="border-[rgba(31,42,54,0.08)] text-black hover:bg-[#EEF2F7]"
                  onClick={openEditLead}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  className="border-[#5E6AD2] text-[#5E6AD2] hover:bg-[#5E6AD2]/10 gap-2"
                  onClick={() => {
                    setSelectedLead(null)
                    if (typeof window !== "undefined") {
                      window.dispatchEvent(new CustomEvent("create-linear-issue", {
                        detail: {
                          title: `Follow up: ${selectedLead.firstName} ${selectedLead.lastName} - ${selectedLead.company ?? ""}`.trim(),
                          description: [
                            `**Lead:** ${selectedLead.firstName} ${selectedLead.lastName}`,
                            selectedLead.email ? `**Email:** ${selectedLead.email}` : null,
                            selectedLead.company ? `**Company:** ${selectedLead.company}` : null,
                            selectedLead.title ? `**Title:** ${selectedLead.title}` : null,
                            selectedLead.aiNextAction ? `\n**AI Recommended Action:** ${selectedLead.aiNextAction}` : null,
                            selectedLead.estimatedValue ? `**Est. Value:** $${selectedLead.estimatedValue.toLocaleString()}` : null,
                          ].filter(Boolean).join("\n"),
                        },
                      }))
                    }
                  }}
                >
                  <SquareKanban className="w-4 h-4" />
                  Create Linear Issue
                </Button>
                <Button className="btn-gold" onClick={openContactLead}>
                  <Send className="w-4 h-4 mr-2" />
                  Contact
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showEditLeadDialog} onOpenChange={setShowEditLeadDialog}>
        <DialogContent className="bg-[#fcfcfc] border-[rgba(31,42,54,0.08)] max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-black">Edit Lead</DialogTitle>
            <DialogDescription>Update the lead’s CRM profile and workflow status.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-600">First name</Label>
              <Input className="mt-1 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]" value={editLeadForm.firstName} onChange={(e) => setEditLeadForm((prev) => ({ ...prev, firstName: e.target.value }))} />
            </div>
            <div>
              <Label className="text-gray-600">Last name</Label>
              <Input className="mt-1 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]" value={editLeadForm.lastName} onChange={(e) => setEditLeadForm((prev) => ({ ...prev, lastName: e.target.value }))} />
            </div>
            <div>
              <Label className="text-gray-600">Email</Label>
              <Input className="mt-1 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]" type="email" value={editLeadForm.email} onChange={(e) => setEditLeadForm((prev) => ({ ...prev, email: e.target.value }))} />
            </div>
            <div>
              <Label className="text-gray-600">Phone</Label>
              <Input className="mt-1 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]" value={editLeadForm.phone} onChange={(e) => setEditLeadForm((prev) => ({ ...prev, phone: e.target.value }))} />
            </div>
            <div>
              <Label className="text-gray-600">Company</Label>
              <Input className="mt-1 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]" value={editLeadForm.company} onChange={(e) => setEditLeadForm((prev) => ({ ...prev, company: e.target.value }))} />
            </div>
            <div>
              <Label className="text-gray-600">Title</Label>
              <Input className="mt-1 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]" value={editLeadForm.title} onChange={(e) => setEditLeadForm((prev) => ({ ...prev, title: e.target.value }))} />
            </div>
            <div>
              <Label className="text-gray-600">Source</Label>
              <Input className="mt-1 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]" value={editLeadForm.source} onChange={(e) => setEditLeadForm((prev) => ({ ...prev, source: e.target.value }))} />
            </div>
            <div>
              <Label className="text-gray-600">Status</Label>
              <Select value={editLeadForm.status} onValueChange={(value) => setEditLeadForm((prev) => ({ ...prev, status: value }))}>
                <SelectTrigger className="mt-1 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="proposal">Proposal</SelectItem>
                  <SelectItem value="negotiation">Negotiation</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-600">Estimated value</Label>
              <Input className="mt-1 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]" type="number" value={editLeadForm.estimatedValue} onChange={(e) => setEditLeadForm((prev) => ({ ...prev, estimatedValue: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-gray-600">AI next action</Label>
              <Textarea className="mt-1 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]" value={editLeadForm.aiNextAction} onChange={(e) => setEditLeadForm((prev) => ({ ...prev, aiNextAction: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-[rgba(31,42,54,0.08)]" onClick={() => setShowEditLeadDialog(false)}>Cancel</Button>
            <Button className="btn-gold" onClick={() => void saveLeadEdits()}>Save lead</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showContactLeadDialog} onOpenChange={setShowContactLeadDialog}>
        <DialogContent className="bg-[#fcfcfc] border-[rgba(31,42,54,0.08)]">
          <DialogHeader>
            <DialogTitle className="text-black">Contact Lead</DialogTitle>
            <DialogDescription>Send or record an SMS follow-up for this lead.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-gray-600">To</Label>
              <Input className="mt-1 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]" value={selectedLead?.phone || ''} readOnly />
            </div>
            <div>
              <Label className="text-gray-600">Message</Label>
              <Textarea className="mt-1 min-h-28 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]" value={contactMessage} onChange={(e) => setContactMessage(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-[rgba(31,42,54,0.08)]" onClick={() => setShowContactLeadDialog(false)}>Cancel</Button>
            <Button className="btn-gold" onClick={() => void sendLeadMessage()}>Send message</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Pipeline View (Kanban)
function SortableItem({ item }: { item: PipelineItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="bg-[#fcfcfc] border-[rgba(31,42,54,0.08)] hover:border-[#2563EB] cursor-grab active:cursor-grabbing mb-2 shadow-sm">
        <CardContent className="p-3">
          <div className="flex items-start justify-between mb-2">
            <h4 className="text-sm font-medium text-black truncate flex-1">{item.title}</h4>
          </div>
          
          {item.value && (
            <p className="text-lg font-semibold text-black mb-2">${item.value.toLocaleString()}</p>
          )}
          
          <div className="flex items-center justify-between">
            {item.aiWinProbability && (
              <Badge variant="outline" className="text-xs border-[#2563EB]/50 text-[#2563EB]">
                {Math.round(item.aiWinProbability * 100)}% win
              </Badge>
            )}
            {item.lead && (
              <Avatar className="w-6 h-6">
                <AvatarFallback className="bg-[#2563EB] text-black text-xs">
                  {item.lead.firstName?.[0]}{item.lead.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function PipelineStageColumn({
  stage,
  children,
}: {
  stage: PipelineStage
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "shrink-0 w-[300px] bg-white rounded-lg border shadow-sm transition-colors",
        isOver ? "border-[#2563EB] bg-[#EFF6FF]" : "border-[rgba(31,42,54,0.08)]"
      )}
    >
      {children}
    </div>
  )
}

function PipelineView() {
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const loadPipeline = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/pipeline")
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setStages(normalizePipelineStages(data.pipeline?.stages))
    } catch (error) {
      toast({
        title: "Failed to load pipeline",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
      setStages(normalizePipelineStages(mockPipelineStages))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPipeline()
  }, [loadPipeline])

  const onDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeId = String(active.id)
    const overId = String(over.id)
    const sourceStage = stages.find((stage) => stage.items.some((item) => item.id === activeId))
    if (!sourceStage) return

    const targetStage = stages.find((stage) => stage.id === overId || stage.items.some((item) => item.id === overId))
    if (!targetStage) return

    const movingItem = sourceStage.items.find((item) => item.id === activeId)
    if (!movingItem) return

    setStages((current) => {
      const next = current.map((stage) => ({
        ...stage,
        items: stage.items.filter((item) => item.id !== activeId),
      }))

      const targetIndex = next.findIndex((stage) => stage.id === targetStage.id)
      if (targetIndex !== -1) {
        next[targetIndex] = {
          ...next[targetIndex],
          items: [...next[targetIndex].items, { ...movingItem, stageId: targetStage.id }],
        }
      }

      return next
    })

    try {
      setSaving(true)
      const res = await fetch("/api/pipeline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: activeId,
          stageId: targetStage.id,
          position: targetStage.items.length,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
    } catch (error) {
      toast({
        title: "Pipeline move failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
      await loadPipeline()
    } finally {
      setSaving(false)
    }
  }, [loadPipeline, stages])
  
  const totalValue = stages.reduce((sum, stage) => 
    sum + stage.items.reduce((s, item) => s + (item.value || 0), 0), 0
  )
  
  return (
    <div className="p-6 space-y-6 bg-[#fcf8ec] min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black">Pipeline</h1>
          <p className="text-gray-500">Drag and drop deals through your sales stages</p>
        </div>
        <div className="flex items-center gap-4">
          <Card className="bg-[#fcfcfc] border-[rgba(31,42,54,0.08)] px-4 py-2 shadow-sm">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#2563EB]" />
              <span className="text-lg font-semibold text-black">${totalValue.toLocaleString()}</span>
              <span className="text-sm text-gray-500">{saving ? "saving…" : "live total"}</span>
            </div>
          </Card>
          <Button className="btn-gold gap-2" onClick={() => window.dispatchEvent(new CustomEvent("open-add-lead"))}>
            <Plus className="w-4 h-4" />
            Add Deal
          </Button>
        </div>
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          Loading pipeline…
        </div>
      ) : (
        <>
          {/* Kanban Board */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => { void onDragEnd(event) }}>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {stages.map((stage) => (
                <PipelineStageColumn key={stage.id} stage={stage}>
                  {/* Column Header */}
                  <div
                    className="p-3 border-b border-[rgba(31,42,54,0.08)] flex items-center justify-between"
                    style={{ borderTopLeftRadius: 8, borderTopRightRadius: 8, borderTop: `3px solid ${stage.color}` }}
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-black">{stage.name}</h3>
                      <Badge variant="secondary" className="bg-[#EEF2F7] text-gray-600">
                        {stage.items.length}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-gray-400 hover:text-[#2563EB]"
                      onClick={() => window.dispatchEvent(new CustomEvent("open-add-lead"))}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                  
                  {/* Column Content */}
                  <ScrollArea className="h-[calc(100vh-320px)]">
                    <div className="p-2">
                      <SortableContext items={stage.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                        {stage.items.map((item) => (
                          <SortableItem key={item.id} item={item} />
                        ))}
                      </SortableContext>
                      
                      {stage.items.length === 0 && (
                        <div className="text-center py-8 text-gray-400 text-sm">
                          Drop a deal here
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </PipelineStageColumn>
              ))}
            </div>
          </DndContext>
        </>
      )}
    </div>
  )
}

// Upload record from API
type UploadRecord = {
  id: string
  fileName: string
  fileSize: number
  totalRows: number
  successfulRows: number
  duplicateRows: number
  failedRows: number
  status: string
  createdAt: string
  aiAutoScored: boolean
}

// Uploads History View
function UploadsView({ onUploadCSV, refreshKey = 0 }: { onUploadCSV: () => void; refreshKey?: number }) {
  const [uploads, setUploads] = useState<UploadRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(buildApiPath('/api/upload?limit=100'))
        const { data, text } = await readApiJsonOrText(res)
        if (cancelled) return
        if (!data) {
          throw new Error(`Upload API returned non-JSON (${res.status}). ${text?.slice(0, 120) || ''}`.trim())
        }
        if (data.error) {
          setError(data.error)
          setUploads([])
          return
        }
        const list = (data.uploads || []).map((u: {
          id: string
          fileName: string
          fileSize: number
          totalRows: number
          successfulRows: number
          duplicateRows: number
          failedRows: number
          status: string
          createdAt: string
          aiAutoScored: boolean
        }) => ({
          id: u.id,
          fileName: u.fileName,
          fileSize: u.fileSize,
          totalRows: u.totalRows,
          successfulRows: u.successfulRows,
          duplicateRows: u.duplicateRows,
          failedRows: u.failedRows,
          status: u.status,
          createdAt: typeof u.createdAt === 'string' ? u.createdAt : new Date(u.createdAt).toISOString(),
          aiAutoScored: !!u.aiAutoScored,
        }))
        setUploads(list)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load uploads')
          setUploads([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [refreshKey])

  return (
    <div className="p-6 space-y-6 bg-[#fcf8ec] min-h-screen">
      {/* Header with Upload NEW CSV on tab */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black">CSV Uploads</h1>
          <p className="text-gray-500">Track your bulk lead imports with detailed history</p>
        </div>
        <Button className="btn-gold gap-2" onClick={onUploadCSV}>
          <Upload className="w-4 h-4" />
          Upload NEW CSV
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-2 text-red-800">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          Loading uploads…
        </div>
      )}

      {!loading && !error && uploads.length === 0 && (
        <Card className="bg-[#fcfcfc] border-[rgba(31,42,54,0.08)]">
          <CardContent className="p-12 text-center">
            <FileSpreadsheet className="w-12 h-12 text-[#2563EB]/60 mx-auto mb-4" />
            <p className="text-gray-600">No uploads yet. Import leads from a CSV to see history here.</p>
            <Button className="btn-gold mt-4 gap-2" onClick={onUploadCSV}>
              <Upload className="w-4 h-4" />
              Upload CSV
            </Button>
          </CardContent>
        </Card>
      )}
      
      {/* Upload History */}
      {!loading && uploads.length > 0 && (
      <div className="space-y-4">
        {uploads.map((upload) => (
          <Card key={upload.id} className="bg-[#fcfcfc] border-[rgba(31,42,54,0.08)] shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-[#2563EB]/20 flex items-center justify-center">
                    <FileSpreadsheet className="w-6 h-6 text-[#2563EB]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-black">{upload.fileName}</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      <span suppressHydrationWarning>Uploaded {new Date(upload.createdAt).toLocaleDateString()} at {new Date(upload.createdAt).toLocaleTimeString()}</span>
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs text-gray-500">{(upload.fileSize / 1024).toFixed(1)} KB</span>
                      <span className="text-xs text-gray-500">{upload.totalRows} rows</span>
                      {upload.aiAutoScored && (
                        <Badge variant="outline" className="text-xs border-[#2563EB]/50 text-[#2563EB]">
                          <Sparkles className="w-3 h-3 mr-1" />
                          AI Scored
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-emerald-600">{upload.successfulRows} imported</span>
                      {upload.duplicateRows > 0 && (
                        <span className="text-amber-600">{upload.duplicateRows} duplicates</span>
                      )}
                      {upload.failedRows > 0 && (
                        <span className="text-red-600">{upload.failedRows} failed</span>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      upload.status === "completed" && "border-emerald-500 text-emerald-600",
                      upload.status === "processing" && "border-blue-500 text-blue-600",
                      upload.status === "failed" && "border-red-500 text-red-600"
                    )}
                  >
                    {upload.status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      )}
    </div>
  )
}

// Linear Issue Priority Helpers
const priorityConfig: Record<number, { label: string; color: string }> = {
  0: { label: "No priority", color: "#6B7280" },
  1: { label: "Urgent", color: "#DC2626" },
  2: { label: "High", color: "#F59E0B" },
  3: { label: "Medium", color: "#3B82F6" },
  4: { label: "Low", color: "#6B7280" },
}

interface LinearIssue {
  id: string
  identifier: string
  title: string
  description?: string
  url: string
  state: { name: string; color: string } | null
  priority: number
  priorityLabel: string
  assignee: { name: string; email: string; avatarUrl?: string } | null
  team: { name: string; key: string } | null
  labels: { name: string; color: string }[]
  createdAt: string
  updatedAt: string
  dueDate: string | null
}

interface LinearTeam {
  id: string
  name: string
  key: string
  description?: string
}

// Linear View - full issue tracker integration
function LinearView({ onCreateIssue }: { onCreateIssue: () => void }) {
  const [issues, setIssues] = useState<LinearIssue[]>([])
  const [teams, setTeams] = useState<LinearTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<string>("all")
  const [selectedIssue, setSelectedIssue] = useState<LinearIssue | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const statusRes = await fetch("/api/linear?action=status")
      const statusData = await statusRes.json()
      if (!statusData.configured) {
        setConfigured(false)
        setLoading(false)
        return
      }
      setConfigured(true)
      setTeams(statusData.teams || [])

      const params = new URLSearchParams({ action: "issues", first: "50" })
      if (selectedTeam !== "all") params.set("teamId", selectedTeam)
      const issuesRes = await fetch(`/api/linear?${params}`)
      const issuesData = await issuesRes.json()
      if (issuesData.error) throw new Error(issuesData.error)
      setIssues(issuesData.issues || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Linear data")
    } finally {
      setLoading(false)
    }
  }, [selectedTeam])

  useEffect(() => { fetchData() }, [fetchData])

  if (!configured) {
    return (
      <div className="p-6 space-y-6 bg-[#fcf8ec] min-h-screen">
        <div>
          <h1 className="text-2xl font-bold text-black">Linear Integration</h1>
          <p className="text-gray-500">Connect your Linear workspace to sync issues</p>
        </div>
        <Card className="bg-[#fcfcfc] border-[rgba(31,42,54,0.08)] shadow-sm">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[#5E6AD2]/10 flex items-center justify-center mx-auto">
              <SquareKanban className="w-8 h-8 text-[#5E6AD2]" />
            </div>
            <h3 className="text-lg font-semibold text-black">Linear Not Connected</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Add your Linear API key to the <code className="bg-[#EEF2F7] px-1.5 py-0.5 rounded text-sm">.env</code> file to enable the integration.
              Get your key from <a href="https://linear.app/settings/api" target="_blank" rel="noopener noreferrer" className="text-[#5E6AD2] underline">Linear Settings &rarr; API</a>.
            </p>
            <div className="bg-[#EEF2F7] rounded-lg p-4 text-left max-w-sm mx-auto">
              <p className="text-xs text-gray-500 mb-1">Add to your .env file:</p>
              <code className="text-sm text-black">LINEAR_API_KEY=&quot;lin_api_...&quot;</code>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 bg-[#fcf8ec] min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black flex items-center gap-2">
            <SquareKanban className="w-6 h-6 text-[#5E6AD2]" />
            Linear Issues
          </h1>
          <p className="text-gray-500">Track and manage issues from your Linear workspace</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="border-[rgba(31,42,54,0.08)] text-gray-600 hover:bg-[#EEF2F7] gap-2"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button className="gap-2 bg-[#5E6AD2] hover:bg-[#4C56B8] text-white" onClick={onCreateIssue}>
            <Plus className="w-4 h-4" />
            New Issue
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { title: "Total Issues", value: issues.length, icon: SquareKanban, color: "#5E6AD2" },
          { title: "In Progress", value: issues.filter(i => i.state?.name?.toLowerCase().includes("progress")).length, icon: Play, color: "#F59E0B" },
          { title: "Urgent/High", value: issues.filter(i => i.priority <= 2 && i.priority > 0).length, icon: AlertTriangle, color: "#DC2626" },
          { title: "Teams", value: teams.length, icon: Users, color: "#059669" },
        ].map((stat) => (
          <Card key={stat.title} className="bg-[#fcfcfc] border-[rgba(31,42,54,0.08)] shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${stat.color}15` }}>
                  <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
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

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <Select value={selectedTeam} onValueChange={setSelectedTeam}>
            <SelectTrigger className="w-[180px] bg-[#fcfcfc] border-[rgba(31,42,54,0.08)]">
              <SelectValue placeholder="Filter by team" />
            </SelectTrigger>
            <SelectContent className="bg-[#fcfcfc] border-[rgba(31,42,54,0.08)]">
              <SelectItem value="all">All Teams</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name} ({t.key})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Issues list */}
      {error && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4 text-red-700 text-sm">{error}</CardContent>
        </Card>
      )}

      <Card className="bg-[#fcfcfc] border-[rgba(31,42,54,0.08)] shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading issues from Linear...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[rgba(31,42,54,0.08)] bg-[#EEF2F7]">
                  <th className="text-left p-4 text-sm font-medium text-gray-600">Issue</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-600">Priority</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-600">Assignee</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-600">Labels</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-600">Updated</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-600"></th>
                </tr>
              </thead>
              <tbody>
                {issues.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-500">
                      No issues found. Create one or check your team filter.
                    </td>
                  </tr>
                ) : (
                  issues.map((issue) => {
                    const pCfg = priorityConfig[issue.priority] ?? priorityConfig[0]
                    return (
                      <motion.tr
                        key={issue.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-b border-[rgba(31,42,54,0.08)] hover:bg-[#fcf8ec] transition-colors cursor-pointer"
                        onClick={() => setSelectedIssue(issue)}
                      >
                        <td className="p-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-gray-400">{issue.identifier}</span>
                              {issue.team && (
                                <Badge variant="outline" className="text-xs border-[rgba(31,42,54,0.08)] text-gray-500">{issue.team.key}</Badge>
                              )}
                            </div>
                            <p className="text-sm font-medium text-black mt-0.5 max-w-[300px] truncate">{issue.title}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          {issue.state && (
                            <div className="flex items-center gap-1.5">
                              <Circle className="w-3 h-3 shrink-0" style={{ color: issue.state.color, fill: issue.state.color }} />
                              <span className="text-sm text-gray-700">{issue.state.name}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ backgroundColor: `${pCfg.color}15`, color: pCfg.color }}>
                            {pCfg.label}
                          </span>
                        </td>
                        <td className="p-4">
                          {issue.assignee ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="w-6 h-6">
                                {issue.assignee.avatarUrl && <AvatarImage src={issue.assignee.avatarUrl} />}
                                <AvatarFallback className="bg-[#5E6AD2] text-white text-xs">
                                  {issue.assignee.name.split(" ").map(n => n[0]).join("")}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm text-gray-600">{issue.assignee.name}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">Unassigned</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1 flex-wrap">
                            {issue.labels.slice(0, 2).map((l) => (
                              <Badge key={l.name} variant="outline" className="text-xs" style={{ borderColor: l.color, color: l.color }}>
                                {l.name}
                              </Badge>
                            ))}
                            {issue.labels.length > 2 && (
                              <span className="text-xs text-gray-400">+{issue.labels.length - 2}</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-xs text-gray-500" suppressHydrationWarning>
                            {new Date(issue.updatedAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="p-4">
                          <a
                            href={issue.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-[#5E6AD2] transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </td>
                      </motion.tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Issue detail modal */}
      <Dialog open={!!selectedIssue} onOpenChange={() => setSelectedIssue(null)}>
        <DialogContent className="bg-[#fcfcfc] border-[rgba(31,42,54,0.08)] max-w-2xl">
          {selectedIssue && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 text-sm text-gray-400 font-mono">
                  {selectedIssue.identifier}
                  {selectedIssue.team && (
                    <Badge variant="outline" className="text-xs border-[rgba(31,42,54,0.08)]">{selectedIssue.team.name}</Badge>
                  )}
                </div>
                <DialogTitle className="text-xl text-black">{selectedIssue.title}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-6 py-4">
                <div className="space-y-4">
                  <div>
                    <Label className="text-gray-500 text-xs">Status</Label>
                    {selectedIssue.state && (
                      <div className="flex items-center gap-2 mt-1">
                        <Circle className="w-3 h-3" style={{ color: selectedIssue.state.color, fill: selectedIssue.state.color }} />
                        <span className="text-black">{selectedIssue.state.name}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-gray-500 text-xs">Priority</Label>
                    <p className="text-black mt-1">{selectedIssue.priorityLabel}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500 text-xs">Assignee</Label>
                    <p className="text-black mt-1">{selectedIssue.assignee?.name ?? "Unassigned"}</p>
                  </div>
                  {selectedIssue.dueDate && (
                    <div>
                      <Label className="text-gray-500 text-xs">Due Date</Label>
                      <p className="text-black mt-1" suppressHydrationWarning>{new Date(selectedIssue.dueDate).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-gray-500 text-xs">Labels</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedIssue.labels.length > 0 ? selectedIssue.labels.map((l) => (
                        <Badge key={l.name} variant="outline" className="text-xs" style={{ borderColor: l.color, color: l.color }}>
                          {l.name}
                        </Badge>
                      )) : <span className="text-gray-400 text-sm">None</span>}
                    </div>
                  </div>
                  {selectedIssue.description && (
                    <div>
                      <Label className="text-gray-500 text-xs">Description</Label>
                      <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {selectedIssue.description}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <a href={selectedIssue.url} target="_blank" rel="noopener noreferrer">
                  <Button className="gap-2 bg-[#5E6AD2] hover:bg-[#4C56B8] text-white">
                    <ExternalLink className="w-4 h-4" />
                    Open in Linear
                  </Button>
                </a>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AutomationView() {
  type AutomationItem = {
    id: string
    name: string
    description: string | null
    trigger: string
    isActive: boolean
    executionCount: number
    lastExecutedAt?: string | null
    actions: Array<Record<string, unknown>>
  }

  const [automations, setAutomations] = useState<AutomationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    trigger: 'lead_created',
    actionType: 'create_task',
    actionTarget: 'Follow up within 5 minutes',
  })

  const loadAutomations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/automations')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAutomations(Array.isArray(data.automations) ? data.automations : [])
    } catch (error) {
      toast({
        title: 'Failed to load automations',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAutomations()
  }, [loadAutomations])

  const createAutomation = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Name required', description: 'Give the automation a name.', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          trigger: form.trigger,
          triggerConfig: { source: 'crm' },
          conditions: {},
          actions: [{ type: form.actionType, target: form.actionTarget }],
          isActive: true,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: 'Automation created', description: `${form.name} is now active.` })
      setShowCreateDialog(false)
      setForm({
        name: '',
        description: '',
        trigger: 'lead_created',
        actionType: 'create_task',
        actionTarget: 'Follow up within 5 minutes',
      })
      await loadAutomations()
    } catch (error) {
      toast({
        title: 'Failed to create automation',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const updateAutomation = async (id: string, payload: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/automations?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      await loadAutomations()
    } catch (error) {
      toast({
        title: 'Automation update failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const deleteAutomation = async (id: string) => {
    try {
      const res = await fetch(`/api/automations?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: 'Automation removed', description: 'Automation deleted successfully.' })
      await loadAutomations()
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const activeCount = automations.filter((automation) => automation.isActive).length

  return (
    <div className="p-6 space-y-6 bg-[#fcf8ec] min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black">AI Automation</h1>
          <p className="text-gray-500">Automate your workflows with intelligent triggers</p>
        </div>
        <Button
          className="btn-gold gap-2"
          onClick={() => setShowCreateDialog(true)}
        >
          <Plus className="w-4 h-4" />
          Create Automation
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: "Active Automations", value: activeCount, icon: Zap },
          { title: "Total Automations", value: automations.length, icon: Activity },
          { title: "Runs Logged", value: automations.reduce((total, automation) => total + automation.executionCount, 0), icon: Brain },
        ].map((stat) => (
          <Card key={stat.title} className="bg-[#fcfcfc] border-[rgba(31,42,54,0.08)] shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#2563EB]/20 flex items-center justify-center">
                  <stat.icon className="w-5 h-5 text-[#2563EB]" />
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

      <Card className="bg-[#fcfcfc] border-[rgba(31,42,54,0.08)] shadow-sm">
        <CardHeader>
          <CardTitle className="text-black">Automation Library</CardTitle>
          <CardDescription>Lead-triggered workflows that run inside your CRM organization.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-gray-500">Loading automations…</div>
          ) : automations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[rgba(31,42,54,0.08)] p-6 text-sm text-gray-500">
              No automations yet. Create a workflow for new leads, stage changes, or follow-up reminders.
            </div>
          ) : (
            <div className="space-y-3">
              {automations.map((automation) => (
                <div key={automation.id} className="rounded-lg border border-[rgba(31,42,54,0.08)] bg-[#EEF2F7] p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-black">{automation.name}</p>
                      <Badge variant="outline" className={automation.isActive ? 'border-emerald-500 text-emerald-600' : 'border-gray-400 text-gray-500'}>
                        {automation.isActive ? 'active' : 'paused'}
                      </Badge>
                      <Badge variant="outline" className="border-[#2563EB]/60 text-[#2563EB] capitalize">
                        {automation.trigger.replaceAll('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{automation.description || 'No description provided.'}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {automation.actions.length} action{automation.actions.length === 1 ? '' : 's'} • {automation.executionCount} run{automation.executionCount === 1 ? '' : 's'}
                      {automation.lastExecutedAt ? ` • Last run ${new Date(automation.lastExecutedAt).toLocaleString()}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={automation.isActive} onCheckedChange={(checked) => void updateAutomation(automation.id, { isActive: checked })} />
                    <Button variant="outline" className="border-[rgba(31,42,54,0.08)]" onClick={() => void deleteAutomation(automation.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-[#fcfcfc] border-[rgba(31,42,54,0.08)]">
          <DialogHeader>
            <DialogTitle className="text-black">Create Automation</DialogTitle>
            <DialogDescription>Set a trigger and default action for your team workflow.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-gray-600">Name</Label>
              <Input className="mt-1 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-gray-600">Description</Label>
              <Textarea className="mt-1 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
            </div>
            <div>
              <Label className="text-gray-600">Trigger</Label>
              <Select value={form.trigger} onValueChange={(value) => setForm((prev) => ({ ...prev, trigger: value }))}>
                <SelectTrigger className="mt-1 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead_created">Lead created</SelectItem>
                  <SelectItem value="lead_scored">Lead scored</SelectItem>
                  <SelectItem value="stage_changed">Pipeline stage changed</SelectItem>
                  <SelectItem value="content_published">Content published</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-600">Action type</Label>
              <Select value={form.actionType} onValueChange={(value) => setForm((prev) => ({ ...prev, actionType: value }))}>
                <SelectTrigger className="mt-1 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="create_task">Create task</SelectItem>
                  <SelectItem value="send_sms">Send SMS</SelectItem>
                  <SelectItem value="assign_owner">Assign owner</SelectItem>
                  <SelectItem value="create_linear_issue">Create Linear issue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-600">Action target</Label>
              <Input className="mt-1 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]" value={form.actionTarget} onChange={(e) => setForm((prev) => ({ ...prev, actionTarget: e.target.value }))} placeholder="Task text, phone, owner email, issue title..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-[rgba(31,42,54,0.08)]" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button className="btn-gold" onClick={() => void createAutomation()} disabled={saving}>
              {saving ? 'Saving...' : 'Create Automation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SocialMediaView() {
  type QueueItem = {
    id: string
    platform: string
    title: string | null
    content: string
    status: string
    scheduledFor: string | null
    publishedAt: string | null
    createdAt: string
    mediaUrls?: string[] | null
  }

  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [showMediaDialog, setShowMediaDialog] = useState(false)
  const [platformFilter, setPlatformFilter] = useState('all')

  const [topic, setTopic] = useState('')
  const [platform, setPlatform] = useState('linkedin')
  const [tone, setTone] = useState('professional')
  const [generatedTitle, setGeneratedTitle] = useState('')
  const [generatedContent, setGeneratedContent] = useState('')
  const [generatedHashtags, setGeneratedHashtags] = useState<string[]>([])
  const [bestTimeToPost, setBestTimeToPost] = useState('')
  const [socialAccounts, setSocialAccounts] = useState<Array<{
    id: string
    platform: string
    accountId: string
    accountName: string | null
    isActive: boolean
    accessTokenConfigured?: boolean
    lastSyncedAt?: string | null
  }>>([])
  const [showSocialAccountDialog, setShowSocialAccountDialog] = useState(false)
  const [socialForm, setSocialForm] = useState({
    platform: 'linkedin',
    accountId: '',
    accountName: '',
    accessToken: '',
  })

  const [mediaTopic, setMediaTopic] = useState('')
  const [mediaPlatform, setMediaPlatform] = useState('linkedin')
  const [mediaPrompt, setMediaPrompt] = useState('')
  const [mediaCaption, setMediaCaption] = useState('')
  const [mediaCta, setMediaCta] = useState('')

  const [composerTitle, setComposerTitle] = useState('')
  const [composerContent, setComposerContent] = useState('')
  const [composerPlatform, setComposerPlatform] = useState('linkedin')
  const [composerScheduleAt, setComposerScheduleAt] = useState('')
  const insuranceCampaignPacks = [
    {
      id: 'life-protection',
      label: 'Life Protection Campaign',
      topic: 'How term life insurance protects family income',
      tone: 'educational',
      defaultPlatform: 'facebook',
      cta: 'Book your family protection review',
    },
    {
      id: 'retirement-health',
      label: 'Health + Retirement',
      topic: 'Medicare timing and avoiding coverage gaps',
      tone: 'authoritative',
      defaultPlatform: 'linkedin',
      cta: 'Schedule a Medicare planning call',
    },
    {
      id: 'business-owner',
      label: 'Business Owner Risk',
      topic: 'Key person and buy-sell protection for small businesses',
      tone: 'professional',
      defaultPlatform: 'linkedin',
      cta: 'Request a business risk strategy session',
    },
  ]

  const fetchContent = useCallback(async () => {
    setLoading(true)
    try {
      const query = platformFilter !== 'all' ? `?platform=${platformFilter}` : ''
      const res = await fetch(`/api/content${query}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setItems(data.items || [])
    } catch (error) {
      toast({
        title: 'Failed to load content queue',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [platformFilter])

  useEffect(() => {
    void fetchContent()
  }, [fetchContent])

  const fetchSocialAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/social-accounts')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSocialAccounts(Array.isArray(data.accounts) ? data.accounts : [])
    } catch (error) {
      toast({
        title: 'Failed to load social accounts',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
      setSocialAccounts([])
    }
  }, [])

  useEffect(() => {
    void fetchSocialAccounts()
  }, [fetchSocialAccounts])

  const saveSocialAccount = async () => {
    if (!socialForm.accountId.trim() || !socialForm.accessToken.trim()) {
      toast({ title: 'Account details required', description: 'Enter the platform account id and access token.', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/social-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: socialForm.platform,
          accountId: socialForm.accountId,
          accountName: socialForm.accountName || undefined,
          accessToken: socialForm.accessToken,
          isActive: true,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: 'Social account connected', description: `${socialForm.platform} is ready for publishing.` })
      setShowSocialAccountDialog(false)
      setSocialForm({ platform: 'linkedin', accountId: '', accountName: '', accessToken: '' })
      await fetchSocialAccounts()
    } catch (error) {
      toast({
        title: 'Failed to connect account',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const toggleSocialAccount = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/social-accounts?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      await fetchSocialAccounts()
    } catch (error) {
      toast({
        title: 'Failed to update account',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const removeSocialAccount = async (id: string) => {
    try {
      const res = await fetch(`/api/social-accounts?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      await fetchSocialAccounts()
    } catch (error) {
      toast({
        title: 'Failed to remove account',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const generateContent = async () => {
    if (!topic.trim()) {
      toast({ title: 'Topic required', description: 'Enter a topic to generate content.', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-content',
          data: { topic, platform, tone },
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setGeneratedTitle(data.title || topic)
      setGeneratedContent(data.content || '')
      setGeneratedHashtags(Array.isArray(data.hashtags) ? data.hashtags : [])
      setBestTimeToPost(data.bestTimeToPost || '')
      toast({ title: 'AI content generated', description: 'Review and save it as draft or scheduled post.' })
    } catch (error) {
      toast({
        title: 'Content generation failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const generateMedia = async () => {
    if (!mediaTopic.trim()) {
      toast({ title: 'Topic required', description: 'Enter a topic to generate media prompt.', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-media',
          data: { topic: mediaTopic, platform: mediaPlatform, style: 'luxury, polished, insurance brand-safe' },
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setMediaPrompt(data.imagePrompt || '')
      setMediaCaption(data.caption || '')
      setMediaCta(data.cta || '')
      toast({ title: 'Media prompt generated', description: 'Use this prompt in your image workflow.' })
    } catch (error) {
      toast({
        title: 'Media generation failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const saveContent = async (payload: {
    title?: string
    content: string
    platform: string
    status: 'draft' | 'scheduled'
    scheduledAt?: string
    mediaUrls?: string[]
  }) => {
    if (!payload.content.trim()) {
      toast({ title: 'Content required', description: 'Cannot save an empty post.', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: 'Post saved', description: payload.status === 'scheduled' ? 'Post scheduled successfully.' : 'Post saved as draft.' })
      await fetchContent()
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const removeItem = async (id: string) => {
    try {
      const res = await fetch(`/api/content?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: 'Post removed', description: 'Content item deleted from queue.' })
      await fetchContent()
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const filteredItems = items.filter((item) => platformFilter === 'all' || item.platform === platformFilter)
  const applyCampaignPack = (pack: typeof insuranceCampaignPacks[number]) => {
    setTopic(pack.topic)
    setTone(pack.tone)
    setPlatform(pack.defaultPlatform)
    setComposerTitle(pack.label)
    setComposerPlatform(pack.defaultPlatform)
    setComposerContent(`${pack.topic}\n\n${pack.cta}`)
    setShowGenerateDialog(true)
  }

  return (
    <div className="p-6 space-y-6 bg-[#fcf8ec] min-h-screen">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black">Social Media</h1>
          <p className="text-gray-500">Elite AI content studio with queue, scheduling, and media prompt generation</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="border-[#2563EB] text-[#2563EB] gap-2" onClick={() => setShowMediaDialog(true)}>
            <ImageIcon className="w-4 h-4" />
            Generate Media
          </Button>
          <Button className="btn-gold gap-2" onClick={() => setShowGenerateDialog(true)}>
            <Sparkles className="w-4 h-4" />
            Generate Content
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {insuranceCampaignPacks.map((pack) => (
          <motion.button
            key={pack.id}
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            type="button"
            onClick={() => applyCampaignPack(pack)}
            className="text-left p-4 bg-[#fcfcfc] border border-[rgba(31,42,54,0.08)] rounded-xl shadow-sm hover:shadow-md transition-shadow"
          >
            <p className="text-sm font-semibold text-black">{pack.label}</p>
            <p className="text-xs text-gray-500 mt-1">{pack.topic}</p>
            <p className="text-xs text-[#64748B] mt-2">CTA: {pack.cta}</p>
          </motion.button>
        ))}
      </div>

      <Card className="bg-[#fcfcfc] border-[rgba(31,42,54,0.08)] shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-black text-lg">Connected Social Accounts</CardTitle>
              <CardDescription>Store the platform identities your scheduled content can publish through.</CardDescription>
            </div>
            <Button variant="outline" className="border-[rgba(31,42,54,0.08)]" onClick={() => setShowSocialAccountDialog(true)}>
              <Plus className="w-4 h-4" />
              Add account
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {socialAccounts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[rgba(31,42,54,0.08)] p-6 text-sm text-gray-500">
              No connected accounts yet. Add LinkedIn, Facebook, Instagram, or X credentials before using automated publishing.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {socialAccounts.map((account) => (
                <div key={account.id} className="rounded-lg border border-[rgba(31,42,54,0.08)] bg-[#EEF2F7] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-black capitalize">{account.platform}</p>
                      <p className="text-xs text-gray-500">{account.accountName || account.accountId}</p>
                    </div>
                    <Badge variant="outline" className={account.isActive ? 'border-emerald-500 text-emerald-600' : 'border-gray-400 text-gray-500'}>
                      {account.isActive ? 'active' : 'paused'}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500">
                    Token stored: {account.accessTokenConfigured ? 'yes' : 'no'}
                    {account.lastSyncedAt ? ` • Synced ${new Date(account.lastSyncedAt).toLocaleString()}` : ''}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <Switch checked={account.isActive} onCheckedChange={(checked) => void toggleSocialAccount(account.id, checked)} />
                    <Button variant="outline" className="border-[rgba(31,42,54,0.08)]" onClick={() => void removeSocialAccount(account.id)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="bg-[#fcfcfc] border-[rgba(31,42,54,0.08)] shadow-sm xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-black text-lg">Manual Composer</CardTitle>
            <CardDescription>Create, draft, and schedule premium brand posts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-gray-600">Platform</Label>
              <Select value={composerPlatform} onValueChange={setComposerPlatform}>
                <SelectTrigger className="mt-1 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="twitter">Twitter/X</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-600">Title</Label>
              <Input className="mt-1 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]" value={composerTitle} onChange={(e) => setComposerTitle(e.target.value)} placeholder="Post title (optional)" />
            </div>
            <div>
              <Label className="text-gray-600">Post content</Label>
              <Textarea className="mt-1 min-h-28 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]" value={composerContent} onChange={(e) => setComposerContent(e.target.value)} placeholder="Write a high-converting post..." />
            </div>
            <div>
              <Label className="text-gray-600">Schedule (optional)</Label>
              <Input type="datetime-local" className="mt-1 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]" value={composerScheduleAt} onChange={(e) => setComposerScheduleAt(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 border-[rgba(31,42,54,0.08)]"
                onClick={() => void saveContent({ title: composerTitle, content: composerContent, platform: composerPlatform, status: 'draft' })}
                disabled={saving}
              >
                Save Draft
              </Button>
              <Button
                className="flex-1 btn-gold"
                onClick={() => void saveContent({ title: composerTitle, content: composerContent, platform: composerPlatform, status: 'scheduled', scheduledAt: composerScheduleAt || undefined })}
                disabled={saving}
              >
                Schedule
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#fcfcfc] border-[rgba(31,42,54,0.08)] shadow-sm xl:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-black text-lg">Content Queue</CardTitle>
                <CardDescription>Manage drafts, scheduled posts, and published content.</CardDescription>
              </div>
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="w-[180px] bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All platforms</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="twitter">Twitter/X</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="py-10 text-center text-gray-500">Loading queue...</div>
            ) : filteredItems.length === 0 ? (
              <div className="py-10 text-center text-gray-500 border border-dashed border-[rgba(31,42,54,0.08)] rounded-lg">
                No posts yet. Generate with AI or create your first draft.
              </div>
            ) : filteredItems.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -1 }}
                className="p-4 bg-[#EEF2F7] border border-[rgba(31,42,54,0.08)] rounded-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize border-[#2563EB]/60 text-[#64748B]">{item.platform}</Badge>
                      <Badge variant="outline" className={cn(
                        item.status === 'published' && 'border-emerald-500 text-emerald-600',
                        item.status === 'scheduled' && 'border-blue-500 text-blue-600',
                        item.status === 'draft' && 'border-gray-400 text-gray-600'
                      )}>{item.status}</Badge>
                    </div>
                    <p className="text-sm font-semibold text-black mt-2">{item.title || 'Untitled post'}</p>
                    <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap line-clamp-3">{item.content}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Created {new Date(item.createdAt).toLocaleString()}
                      {item.scheduledFor ? ` • Scheduled ${new Date(item.scheduledFor).toLocaleString()}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.status !== 'published' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-[rgba(31,42,54,0.08)]"
                        onClick={() => void fetch(`/api/content?id=${item.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ status: 'published', publishedAt: new Date().toISOString() }),
                        }).then(() => fetchContent())}
                      >
                        Publish
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => void removeItem(item.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="bg-[#fcfcfc] border-[rgba(31,42,54,0.08)] max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-black flex items-center gap-2"><Sparkles className="w-5 h-5 text-[#2563EB]" />Generate Social Content</DialogTitle>
            <DialogDescription>Create premium content with AI and save directly to queue.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-3">
              <Label className="text-gray-600">Topic</Label>
              <Input className="mt-1 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Life insurance myths families should stop believing" />
            </div>
            <div>
              <Label className="text-gray-600">Platform</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="mt-1 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="twitter">Twitter/X</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-600">Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger className="mt-1 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="authoritative">Authoritative</SelectItem>
                  <SelectItem value="educational">Educational</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button className="w-full btn-gold" onClick={() => void generateContent()} disabled={saving}>
                {saving ? 'Generating...' : 'Generate'}
              </Button>
            </div>
          </div>
          <Separator />
          <div className="space-y-3">
            <div>
              <Label className="text-gray-600">Generated title</Label>
              <Input className="mt-1 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]" value={generatedTitle} onChange={(e) => setGeneratedTitle(e.target.value)} />
            </div>
            <div>
              <Label className="text-gray-600">Generated content</Label>
              <Textarea className="mt-1 min-h-32 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]" value={generatedContent} onChange={(e) => setGeneratedContent(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              {generatedHashtags.map((h) => (
                <Badge key={h} variant="outline" className="border-[rgba(31,42,54,0.08)]">{h}</Badge>
              ))}
            </div>
            {bestTimeToPost && <p className="text-xs text-gray-500">Best time to post: {bestTimeToPost}</p>}
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              className="border-[rgba(31,42,54,0.08)]"
              onClick={() => void saveContent({ title: generatedTitle, content: generatedContent, platform, status: 'draft' })}
              disabled={saving}
            >
              Save as Draft
            </Button>
            <Button
              className="btn-gold"
              onClick={() => void saveContent({ title: generatedTitle, content: generatedContent, platform, status: 'scheduled', scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() })}
              disabled={saving}
            >
              Quick Schedule (+1h)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMediaDialog} onOpenChange={setShowMediaDialog}>
        <DialogContent className="bg-[#fcfcfc] border-[rgba(31,42,54,0.08)] max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-black flex items-center gap-2"><ImageIcon className="w-5 h-5 text-[#2563EB]" />Generate Media Prompt</DialogTitle>
            <DialogDescription>Create image prompts and caption/CTA for high-performing visuals.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-gray-600">Topic</Label>
              <Input className="mt-1 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]" value={mediaTopic} onChange={(e) => setMediaTopic(e.target.value)} placeholder="Family life insurance peace of mind visual" />
            </div>
            <div>
              <Label className="text-gray-600">Platform</Label>
              <Select value={mediaPlatform} onValueChange={setMediaPlatform}>
                <SelectTrigger className="mt-1 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="twitter">Twitter/X</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="btn-gold w-full" onClick={() => void generateMedia()} disabled={saving}>
              {saving ? 'Generating...' : 'Generate media pack'}
            </Button>
            <div>
              <Label className="text-gray-600">Image prompt</Label>
              <Textarea className="mt-1 min-h-24 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]" value={mediaPrompt} onChange={(e) => setMediaPrompt(e.target.value)} />
            </div>
            <div>
              <Label className="text-gray-600">Caption</Label>
              <Textarea className="mt-1 min-h-16 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]" value={mediaCaption} onChange={(e) => setMediaCaption(e.target.value)} />
            </div>
            <div>
              <Label className="text-gray-600">CTA</Label>
              <Input className="mt-1 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]" value={mediaCta} onChange={(e) => setMediaCta(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button
              className="btn-gold"
              onClick={() => void saveContent({
                title: mediaTopic || 'AI media post',
                content: `${mediaCaption}\n\nCTA: ${mediaCta}\n\n[MEDIA PROMPT]\n${mediaPrompt}`,
                platform: mediaPlatform,
                status: 'draft',
                mediaUrls: [],
              })}
              disabled={saving}
            >
              Save media draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSocialAccountDialog} onOpenChange={setShowSocialAccountDialog}>
        <DialogContent className="bg-[#fcfcfc] border-[rgba(31,42,54,0.08)]">
          <DialogHeader>
            <DialogTitle className="text-black">Connect Social Account</DialogTitle>
            <DialogDescription>Store the platform account details this workspace should publish through.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-gray-600">Platform</Label>
              <Select value={socialForm.platform} onValueChange={(value) => setSocialForm((prev) => ({ ...prev, platform: value }))}>
                <SelectTrigger className="mt-1 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="twitter">Twitter / X</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-600">Account ID / page ID</Label>
              <Input className="mt-1 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]" value={socialForm.accountId} onChange={(e) => setSocialForm((prev) => ({ ...prev, accountId: e.target.value }))} />
            </div>
            <div>
              <Label className="text-gray-600">Display name</Label>
              <Input className="mt-1 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]" value={socialForm.accountName} onChange={(e) => setSocialForm((prev) => ({ ...prev, accountName: e.target.value }))} />
            </div>
            <div>
              <Label className="text-gray-600">Access token</Label>
              <Input className="mt-1 bg-[#EEF2F7] border-[rgba(31,42,54,0.08)]" type="password" value={socialForm.accessToken} onChange={(e) => setSocialForm((prev) => ({ ...prev, accessToken: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-[rgba(31,42,54,0.08)]" onClick={() => setShowSocialAccountDialog(false)}>Cancel</Button>
            <Button className="btn-gold" onClick={() => void saveSocialAccount()} disabled={saving}>
              {saving ? 'Saving...' : 'Save Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Main App
export default function EliteCRM() {
  const [activeView, setActiveView] = useState("dashboard")
  const { authLoading, currentUser, signOut } = useWorkspaceSession()
  const { theme } = useAppStore()
  const {
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
  } = useWorkspaceOverlays()

  const renderView = () => {
    switch (activeView) {
      case "dashboard": return <DashboardView />
      case "leads": return <LeadsView onAddLead={() => setShowAddLeadDialog(true)} onUploadCSV={() => setShowUploadDialog(true)} onScrape={() => setShowScrapeDialog(true)} refreshKey={leadsRefreshKey} />
      case "pipeline": return <PipelineView />
      case "linear": return <LinearView onCreateIssue={() => openLinearIssueDialog()} />
      case "uploads": return <UploadsView onUploadCSV={() => setShowUploadDialog(true)} refreshKey={uploadsRefreshKey} />
      case "automation": return <AutomationView />
      case "assistant": return <AiAssistantView />
      case "social": return <SocialMediaView />
      case "settings": return <SettingsView />
      default: return <DashboardView />
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#fcf8ec] flex items-center justify-center text-gray-500">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Loading workspace…
      </div>
    )
  }
  
  return (
    <AppShell
      activeView={activeView}
      setActiveView={setActiveView}
      currentUser={currentUser}
      onAddLead={() => setShowAddLeadDialog(true)}
      onSignOut={() => void signOut()}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={activeView}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
        >
          {renderView()}
        </motion.div>
      </AnimatePresence>

      <WorkspaceOverlays
        showAddLeadDialog={showAddLeadDialog}
        setShowAddLeadDialog={setShowAddLeadDialog}
        onLeadCreated={handleLeadCreated}
        showUploadDialog={showUploadDialog}
        setShowUploadDialog={setShowUploadDialog}
        uploading={uploading}
        onFileUpload={handleFileUpload}
        showScrapeDialog={showScrapeDialog}
        setShowScrapeDialog={setShowScrapeDialog}
        scrapeForm={scrapeForm}
        setScrapeForm={setScrapeForm}
        scraping={scraping}
        onScrapeSubmit={() => void handleScrapeSubmit()}
        scrapeJobs={scrapeJobs}
        showLinearIssueDialog={showLinearIssueDialog}
        setShowLinearIssueDialog={setShowLinearIssueDialog}
        linearIssuePrefill={linearIssuePrefill}
        commandPaletteOpen={commandPaletteOpen}
        setCommandPaletteOpen={setCommandPaletteOpen}
        onNavigate={setActiveView}
        onAddLead={() => setShowAddLeadDialog(true)}
        onUploadCSV={() => setShowUploadDialog(true)}
      />
    </AppShell>
  )
}
