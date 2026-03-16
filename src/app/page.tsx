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
import { useAppStore, type Lead, type PipelineItem, type Activity as ActivityType, type AIInsight } from "@/lib/store"
import { DndContext, closestCorners, KeyboardSensor, PointerSensor, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent, type DragOverEvent, useDroppable } from "@dnd-kit/core"
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell, LineChart, Line } from "recharts"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { CommandPalette, useCommandPalette } from "@/components/command-palette"
import { triggerWinCelebration, triggerSmallCelebration } from "@/lib/celebrations"
import { toast } from "@/hooks/use-toast"

// ============================================
// ELITE CRM - LUXURY GOLD THEME
// ============================================

// Mock Data - fixed ISO dates to avoid hydration mismatch
const _base = "2026-03-11T22:00:00.000Z"
const _yesterday = "2026-03-10T22:00:00.000Z"
const mockLeads: Lead[] = [
  { id: "1", firstName: "Sarah", lastName: "Johnson", email: "sarah@techcorp.com", phone: "(555) 123-4567", company: "TechCorp Inc", title: "CTO", source: "linkedin", status: "qualified", aiScore: 92, aiConfidence: 0.89, aiInsights: { intent: "high", budget: "confirmed" }, aiNextAction: "Schedule demo call", estimatedValue: 50000, lastContactedAt: _base, createdAt: _base, tags: [{ id: "1", name: "Hot Lead", color: "#D4AF37" }] },
  { id: "2", firstName: "Michael", lastName: "Chen", email: "mchen@startup.io", phone: "(555) 234-5678", company: "Startup.io", title: "Founder", source: "referral", status: "new", aiScore: 78, aiConfidence: 0.75, aiInsights: { intent: "medium" }, aiNextAction: "Send introductory email", estimatedValue: 25000, lastContactedAt: null, createdAt: _base, tags: [] },
  { id: "3", firstName: "Emily", lastName: "Davis", email: "emily@enterprise.com", phone: "(555) 345-6789", company: "Enterprise Solutions", title: "VP of Sales", source: "website", status: "proposal", aiScore: 85, aiConfidence: 0.82, aiInsights: { intent: "high", timeline: "Q1" }, aiNextAction: "Follow up on proposal", estimatedValue: 75000, lastContactedAt: _yesterday, createdAt: _base, tags: [{ id: "2", name: "Enterprise", color: "#0A0A0A" }] },
  { id: "4", firstName: "James", lastName: "Wilson", email: "jwilson@agency.co", phone: "(555) 456-7890", company: "Creative Agency", title: "Director", source: "google", status: "negotiation", aiScore: 88, aiConfidence: 0.91, aiInsights: { intent: "high", decisionMaker: true }, aiNextAction: "Send contract", estimatedValue: 120000, lastContactedAt: _base, createdAt: _base, tags: [] },
  { id: "5", firstName: "Lisa", lastName: "Anderson", email: "lisa@retail.com", phone: "(555) 567-8901", company: "Retail Giants", title: "CEO", source: "referral", status: "new", aiScore: 65, aiConfidence: 0.68, aiInsights: {}, aiNextAction: "Research company needs", estimatedValue: 30000, lastContactedAt: null, createdAt: _base, tags: [] },
]

const _p1Close = "2026-04-10T22:00:00.000Z"
const _p2Close = "2026-05-10T22:00:00.000Z"
const _p3Close = "2026-03-25T22:00:00.000Z"
const _p4Close = "2026-03-30T22:00:00.000Z"
const _p5Close = "2026-03-22T22:00:00.000Z"
const mockPipelineStages = [
  { id: "new", name: "New", color: "#0A0A0A", order: 0, items: [
    { id: "p1", title: "Michael Chen - Startup.io", value: 25000, probability: 20, stageId: "new", leadId: "2", lead: mockLeads[1], aiWinProbability: 0.35, expectedClose: _p1Close },
    { id: "p2", title: "Lisa Anderson - Retail Giants", value: 30000, probability: 15, stageId: "new", leadId: "5", lead: mockLeads[4], aiWinProbability: 0.28, expectedClose: _p2Close },
  ]},
  { id: "contacted", name: "Contacted", color: "#6B7280", order: 1, items: [] },
  { id: "qualified", name: "Qualified", color: "#D4AF37", order: 2, items: [
    { id: "p3", title: "Sarah Johnson - TechCorp", value: 50000, probability: 60, stageId: "qualified", leadId: "1", lead: mockLeads[0], aiWinProbability: 0.72, expectedClose: _p3Close },
  ]},
  { id: "proposal", name: "Proposal", color: "#0284C7", order: 3, items: [
    { id: "p4", title: "Emily Davis - Enterprise", value: 75000, probability: 70, stageId: "proposal", leadId: "3", lead: mockLeads[2], aiWinProbability: 0.68, expectedClose: _p4Close },
  ]},
  { id: "negotiation", name: "Negotiation", color: "#8B7355", order: 4, items: [
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
  { name: "LinkedIn", value: 35, color: "#D4AF37" },
  { name: "Referral", value: 28, color: "#0A0A0A" },
  { name: "Website", value: 20, color: "#B8860B" },
  { name: "Google", value: 12, color: "#F4D03F" },
  { name: "Other", value: 5, color: "#8B7355" },
]

const chartConfig: ChartConfig = {
  leads: { label: "Leads", color: "#D4AF37" },
  won: { label: "Won", color: "#0A0A0A" },
  revenue: { label: "Revenue", color: "#B8860B" },
}

// Utility Components
function AnimatedNumber({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0)
  
  useEffect(() => {
    const duration = 1000
    const steps = 60
    const stepValue = value / steps
    let current = 0
    const timer = setInterval(() => {
      current += stepValue
      if (current >= value) {
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
  const color = score >= 80 ? "bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-black" : 
                score >= 60 ? "bg-[#B8860B] text-white" : "bg-[#0A0A0A] text-white"
  return (
    <div className={cn("px-2 py-0.5 rounded text-xs font-semibold", color)}>
      {score}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    new: "bg-black text-white",
    contacted: "bg-gray-600 text-white",
    qualified: "bg-[#D4AF37] text-black",
    proposal: "bg-blue-600 text-white",
    negotiation: "bg-[#8B7355] text-white",
    won: "bg-emerald-600 text-white",
    lost: "bg-red-600 text-white",
  }
  return (
    <span className={cn("px-2 py-0.5 rounded text-xs font-medium capitalize", styles[status] || "bg-gray-500 text-white")}>
      {status}
    </span>
  )
}

// Sidebar Component
function Sidebar({ activeView, setActiveView }: { activeView: string; setActiveView: (v: string) => void }) {
  const { sidebarOpen, setSidebarOpen } = useAppStore()
  
  const menuItems = [
    { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { id: "leads", icon: Users, label: "Leads" },
    { id: "pipeline", icon: GitBranch, label: "Pipeline" },
    { id: "uploads", icon: Upload, label: "CSV Uploads" },
    { id: "linear", icon: SquareKanban, label: "Linear" },
    { id: "automation", icon: Zap, label: "AI Automation" },
    { id: "social", icon: Share2, label: "Social Media" },
    { id: "settings", icon: Settings, label: "Settings" },
  ]
  
  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarOpen ? 260 : 80 }}
      className="h-screen bg-[#0A0A0A] border-r border-[#2A2A2A] flex flex-col fixed left-0 top-0 z-40"
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[#2A2A2A]">
        <AnimatePresence mode="wait">
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <div className="w-9 h-9 rounded-lg bg-linear-to-br from-[#D4AF37] to-[#F4D03F] flex items-center justify-center">
                <Bot className="w-5 h-5 text-black" />
              </div>
              <span className="font-bold text-xl text-white">Elite<span className="text-[#D4AF37]">CRM</span></span>
            </motion.div>
          )}
        </AnimatePresence>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-gray-400 hover:text-white hover:bg-[#1A1A1A]"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              activeView === item.id
                ? "bg-linear-to-r from-[#D4AF37]/20 to-transparent text-[#D4AF37] border-l-2 border-[#D4AF37]"
                : "text-gray-400 hover:bg-[#1A1A1A] hover:text-white"
            )}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            <AnimatePresence mode="wait">
              {sidebarOpen && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="text-sm font-medium whitespace-nowrap"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        ))}
      </nav>
      
      {/* User Profile */}
      <div className="p-3 border-t border-[#2A2A2A]">
        <div className={cn(
          "flex items-center gap-3 p-2 rounded-lg bg-[#1A1A1A]",
          !sidebarOpen && "justify-center"
        )}>
          <Avatar className="w-9 h-9 border-2 border-[#D4AF37]">
            <AvatarFallback className="bg-[#D4AF37] text-black font-semibold">JD</AvatarFallback>
          </Avatar>
          <AnimatePresence mode="wait">
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 min-w-0"
              >
                <p className="text-sm font-medium text-white truncate">John Doe</p>
                <p className="text-xs text-[#D4AF37] truncate">Admin</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  )
}

// Mock notifications for dropdown
const mockNotifications = [
  { id: "1", title: "New lead assigned", body: "Sarah Johnson from TechCorp was assigned to you", time: "2m ago", unread: true },
  { id: "2", title: "Deal won", body: "James Wilson - Creative Agency closed at $120K", time: "1h ago", unread: true },
  { id: "3", title: "AI insight ready", body: "3 leads haven't been contacted in 7+ days", time: "3h ago", unread: false },
]

// Header Component
function Header({ onAddLead, onNotifications }: { onAddLead: () => void; onNotifications?: () => void }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const unreadCount = mockNotifications.filter(n => n.unread).length
  return (
    <header className="h-16 bg-white/80 backdrop-blur-sm border-b border-[#E8E4D9] flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search leads, deals, contacts..."
            className="pl-10 bg-[#F8F4E8] border-[#E8E4D9] focus:border-[#D4AF37] focus:ring-[#D4AF37]"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative text-gray-500 hover:text-[#D4AF37] hover:bg-[#FEFCF6]"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-[#D4AF37] rounded-full" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 bg-white border-[#E8E4D9]">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Notifications</span>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="bg-[#D4AF37]/20 text-[#B8860B]">{unreadCount}</Badge>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {mockNotifications.map((n) => (
              <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-0.5 p-3 cursor-pointer">
                <span className={cn("text-sm font-medium text-black", n.unread && "font-semibold")}>{n.title}</span>
                <span className="text-xs text-gray-500">{n.body}</span>
                <span className="text-xs text-gray-400">{n.time}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-center text-[#D4AF37] font-medium" onSelect={() => setNotificationsOpen(false)}>
              Mark all as read
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <Button className="btn-gold gap-2" onClick={onAddLead}>
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Lead</span>
        </Button>
      </div>
    </header>
  )
}

// Dashboard View
function DashboardView() {
  const [myDay, setMyDay] = useState<{
    summary: string
    leadsToCall: { id: string; name: string; company?: string | null; aiScore: number; reason: string }[]
    meetings: { id: string; title: string; time: string; lead: { name: string } | null }[]
  } | null>(null)

  useEffect(() => {
    fetch('/api/ai/my-day?limit=5')
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setMyDay(data)
      })
      .catch(() => {
        // silent fallback to mock-only dashboard blocks
      })
  }, [])

  return (
    <div className="p-6 space-y-6 bg-[#FEFCF6] min-h-screen">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Total Leads", value: 156, change: 12, icon: Users, color: "gold" },
          { title: "Pipeline Value", value: 280000, change: 8, icon: DollarSign, color: "black", prefix: "$" },
          { title: "Avg Lead Score", value: 78, change: 5, icon: Target, color: "gold" },
          { title: "Won This Month", value: 24, change: 18, icon: CheckCircle2, color: "emerald" },
        ].map((stat) => (
          <Card key={stat.title} className="bg-white border-[#E8E4D9] shadow-sm hover:shadow-md transition-shadow card-hover">
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
                  stat.color === "gold" && "bg-[#D4AF37]/20",
                  stat.color === "black" && "bg-black",
                  stat.color === "emerald" && "bg-emerald-100",
                )}>
                  <stat.icon className={cn(
                    "w-5 h-5",
                    stat.color === "gold" && "text-[#D4AF37]",
                    stat.color === "black" && "text-white",
                    stat.color === "emerald" && "text-emerald-600",
                  )} />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-3">
                {stat.change > 0 ? (
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                )}
                <span className={cn("text-sm font-medium", stat.change > 0 ? "text-emerald-500" : "text-red-500")}>
                  {stat.change > 0 ? "+" : ""}{stat.change}%
                </span>
                <span className="text-sm text-gray-400 ml-1">vs last month</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2 bg-white border-[#E8E4D9] shadow-sm">
          <CardHeader>
            <CardTitle className="text-black">Revenue & Leads</CardTitle>
            <CardDescription className="text-gray-500">Monthly performance overview</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[280px]">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorWon" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0A0A0A" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#0A0A0A" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E4D9" />
                <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="leads" stroke="#D4AF37" fillOpacity={1} fill="url(#colorLeads)" strokeWidth={2} />
                <Area type="monotone" dataKey="won" stroke="#0A0A0A" fillOpacity={1} fill="url(#colorWon)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
        
        {/* Lead Sources */}
        <Card className="bg-white border-[#E8E4D9] shadow-sm">
          <CardHeader>
            <CardTitle className="text-black">Lead Sources</CardTitle>
            <CardDescription className="text-gray-500">Distribution by channel</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {sourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-4">
              {sourceData.map((source) => (
                <div key={source.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: source.color }} />
                    <span className="text-sm text-gray-600">{source.name}</span>
                  </div>
                  <span className="text-sm font-medium text-black">{source.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* AI Insights & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Insights */}
        <Card className="bg-white border-[#E8E4D9] shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#D4AF37]" />
              <CardTitle className="text-black">AI Insights</CardTitle>
            </div>
            <CardDescription className="text-gray-500">Smart recommendations powered by AI</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {mockInsights.filter(i => !i.dismissed).slice(0, 4).map((insight) => (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "p-3 rounded-lg border",
                  insight.type === "prediction" && "bg-[#D4AF37]/5 border-[#D4AF37]/30",
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
                        insight.type === "prediction" && "text-[#D4AF37]",
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
                    <Button size="sm" variant="ghost" className="text-[#D4AF37] hover:bg-[#D4AF37]/10 h-7 px-2">
                      <ArrowUpRight className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
        
        {/* Recent Activity */}
        <Card className="bg-white border-[#E8E4D9] shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#D4AF37]" />
              <CardTitle className="text-black">Recent Activity</CardTitle>
            </div>
            <CardDescription className="text-gray-500">Latest actions and updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockActivities.slice(0, 5).map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    activity.type === "email" && "bg-blue-100 text-blue-600",
                    activity.type === "call" && "bg-emerald-100 text-emerald-600",
                    activity.type === "meeting" && "bg-purple-100 text-purple-600",
                    activity.type === "ai_analysis" && "bg-[#D4AF37]/20 text-[#D4AF37]",
                  )}>
                    {activity.type === "email" && <Mail className="w-4 h-4" />}
                    {activity.type === "call" && <Phone className="w-4 h-4" />}
                    {activity.type === "meeting" && <Calendar className="w-4 h-4" />}
                    {activity.type === "ai_analysis" && <Brain className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-black truncate">{activity.title}</p>
                    <p className="text-xs text-gray-500 truncate">{activity.description}</p>
                    <p className="text-xs text-gray-400 mt-1" suppressHydrationWarning>
                      {new Date(activity.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {myDay && (
        <Card className="bg-white border-[#E8E4D9] shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-[#D4AF37]" />
              <CardTitle className="text-black">AI Daily Assistant</CardTitle>
            </div>
            <CardDescription className="text-gray-500">{myDay.summary}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold text-black mb-3">Priority Leads to Call</h4>
              <div className="space-y-2">
                {myDay.leadsToCall.slice(0, 5).map((lead) => (
                  <div key={lead.id} className="p-3 bg-[#F8F4E8] rounded-lg border border-[#E8E4D9]">
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
                  <div className="p-3 bg-[#F8F4E8] rounded-lg border border-[#E8E4D9] text-sm text-gray-500">
                    No meetings queued yet.
                  </div>
                ) : myDay.meetings.slice(0, 5).map((meeting) => (
                  <div key={meeting.id} className="p-3 bg-[#F8F4E8] rounded-lg border border-[#E8E4D9]">
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

  return (
    <div className="p-6 space-y-6 bg-[#FEFCF6] min-h-screen">
      {/* Header with Add new lead + Import CSV on tab */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black">Leads</h1>
          <p className="text-gray-500">AI-powered lead management with smart scoring</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="border-[#0A0A0A] text-[#0A0A0A] hover:bg-black/5 gap-2"
            onClick={onScrape}
          >
            <Globe className="w-4 h-4" />
            Scrape Leads
          </Button>
          <Button 
            variant="outline" 
            className="border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10 gap-2"
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
            <SelectTrigger className="w-[140px] bg-white border-[#E8E4D9]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent className="bg-white border-[#E8E4D9]">
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
          <SelectTrigger className="w-[140px] bg-white border-[#E8E4D9]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent className="bg-white border-[#E8E4D9]">
            <SelectItem value="score">AI Score</SelectItem>
            <SelectItem value="value">Value</SelectItem>
            <SelectItem value="date">Date Added</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Leads Table */}
      <Card className="bg-white border-[#E8E4D9] shadow-sm overflow-hidden">
        {error && (
          <div className="p-4 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm">{error}</div>
        )}
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading leads...</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E8E4D9] bg-[#F8F4E8]">
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
                  className="border-b border-[#E8E4D9] hover:bg-[#FEFCF6] transition-colors cursor-pointer"
                  onClick={() => setSelectedLead(lead)}
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-9 h-9">
                        <AvatarFallback className="bg-[#D4AF37] text-black text-sm font-medium">
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
                    <Badge variant="outline" className="capitalize border-[#E8E4D9] text-gray-600">
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
                        className="text-[#D4AF37] hover:bg-[#D4AF37]/10"
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
        <DialogContent className="bg-white border-[#E8E4D9] max-w-2xl">
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
                    <p className="text-[#D4AF37]">{selectedLead.aiNextAction}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500 text-xs">Status</Label>
                    <div className="mt-1">
                      <StatusBadge status={selectedLead.status} />
                    </div>
                  </div>
                </div>
              </div>

              <Card className="bg-[#FEFCF6] border-[#E8E4D9]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-black">
                    <Bot className="w-4 h-4 text-[#D4AF37]" />
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
                      <Badge variant="outline" className="border-[#E8E4D9] text-gray-600 capitalize">
                        Source: {assistantSource}
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      className="border-[#E8E4D9] text-gray-700 hover:bg-[#F8F4E8]"
                      disabled={!assistantPlaybook || assistantSaving}
                      onClick={() => void savePlaybookToTimeline(selectedLead.id)}
                    >
                      {assistantSaving ? 'Saving...' : 'Save to timeline'}
                    </Button>
                  </div>

                  {assistantPlaybook && (
                    <div className="space-y-4">
                      <div className="rounded-lg border border-[#E8E4D9] bg-white p-4">
                        <p className="text-xs text-gray-500">Recommended Carrier</p>
                        <p className="text-sm font-semibold text-black mt-1">
                          {assistantPlaybook.recommendedCarrier.name}
                          <span className="text-xs text-gray-500 ml-2">
                            ({Math.round((assistantPlaybook.recommendedCarrier.confidence || 0) * 100)}% confidence)
                          </span>
                        </p>
                        <p className="text-sm text-gray-600 mt-2">{assistantPlaybook.recommendedCarrier.rationale}</p>
                        <p className="text-sm text-[#D4AF37] mt-2">
                          Plan suggestion: {assistantPlaybook.suggestedPlanType}
                        </p>
                      </div>

                      {assistantPlaybook.backupCarriers?.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 mb-2">Backup Carriers</p>
                          <div className="space-y-2">
                            {assistantPlaybook.backupCarriers.map((carrier, idx) => (
                              <div key={`${carrier.name}-${idx}`} className="rounded-lg border border-[#E8E4D9] bg-white p-3">
                                <p className="text-sm font-medium text-black">{carrier.name}</p>
                                <p className="text-xs text-gray-600 mt-1">{carrier.rationale}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="rounded-lg border border-[#E8E4D9] bg-white p-3">
                          <p className="text-xs text-gray-500 mb-2">Qualification Summary</p>
                          <ul className="text-sm text-gray-700 space-y-1">
                            {assistantPlaybook.qualificationSummary.map((item, idx) => (
                              <li key={`qual-${idx}`}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-lg border border-[#E8E4D9] bg-white p-3">
                          <p className="text-xs text-gray-500 mb-2">Objection Handling</p>
                          <ul className="text-sm text-gray-700 space-y-1">
                            {assistantPlaybook.objectionHandling.map((item, idx) => (
                              <li key={`obj-${idx}`}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="rounded-lg border border-[#E8E4D9] bg-white p-3 space-y-2">
                        <p className="text-xs text-gray-500">Follow-up Scripts</p>
                        <p className="text-sm text-gray-700"><span className="font-medium text-black">Call opening:</span> {assistantPlaybook.followUpScripts.callOpening}</p>
                        <p className="text-sm text-gray-700"><span className="font-medium text-black">SMS:</span> {assistantPlaybook.followUpScripts.sms}</p>
                        <p className="text-sm text-gray-700"><span className="font-medium text-black">Email subject:</span> {assistantPlaybook.followUpScripts.emailSubject}</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap"><span className="font-medium text-black">Email body:</span> {assistantPlaybook.followUpScripts.emailBody}</p>
                      </div>

                      {assistantPlaybook.citations?.length > 0 && (
                        <div className="rounded-lg border border-[#E8E4D9] bg-white p-3 space-y-2">
                          <p className="text-xs text-gray-500">Grounding Citations</p>
                          {assistantPlaybook.citations.slice(0, 4).map((c, idx) => (
                            <div key={`${c.documentId}-${c.chunkIndex}-${idx}`} className="rounded border border-[#F2EEE1] bg-[#FEFCF6] p-2">
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
                <Button variant="outline" className="border-[#E8E4D9] text-black hover:bg-[#F8F4E8]">
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
                <Button className="btn-gold">
                  <Send className="w-4 h-4 mr-2" />
                  Contact
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Pipeline View (Kanban)
function SortableItem({ item }: { item: PipelineItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    touchAction: 'none',
  }
  
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="select-none">
      <Card className="bg-white border-[#E8E4D9] hover:border-[#D4AF37] cursor-grab active:cursor-grabbing mb-2 shadow-sm">
        <CardContent className="p-3">
          <div className="flex items-start justify-between mb-2">
            <h4 className="text-sm font-medium text-black truncate flex-1">{item.title}</h4>
          </div>
          
          {item.value && (
            <p className="text-lg font-semibold text-black mb-2">${item.value.toLocaleString()}</p>
          )}
          
          <div className="flex items-center justify-between">
            {item.aiWinProbability && (
              <Badge variant="outline" className="text-xs border-[#D4AF37]/50 text-[#D4AF37]">
                {Math.round(item.aiWinProbability * 100)}% win
              </Badge>
            )}
            {item.lead && (
              <Avatar className="w-6 h-6">
                <AvatarFallback className="bg-[#D4AF37] text-black text-xs">
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

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={cn("min-h-[120px] p-2 transition-colors", isOver && "bg-[#D4AF37]/5 rounded-md")}>
      {children}
    </div>
  )
}

function PipelineView() {
  const [stages, setStages] = useState(mockPipelineStages)
  const [loading, setLoading] = useState(true)
  const [activeItemId, setActiveItemId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/pipeline')
      .then((r) => r.json())
      .then((data) => {
        if (data.pipeline?.stages && data.pipeline.stages.length > 0) {
          const mapped = data.pipeline.stages.map((s: { id: string; name: string; color: string; order: number; items: Array<{ id: string; title: string; value: number | null; probability: number | null; stageId: string; leadId: string | null; lead: Lead | null; expectedClose: string | null }> }) => ({
            id: s.id,
            name: s.name,
            color: s.color || '#6B7280',
            order: s.order,
            items: (s.items || []).map((item: { id: string; title: string; value: number | null; probability: number | null; stageId: string; leadId: string | null; lead: Lead | null; expectedClose: string | null }) => ({
              id: item.id,
              title: item.title,
              value: item.value,
              probability: item.probability,
              stageId: item.stageId || s.id,
              leadId: item.leadId,
              lead: item.lead,
              aiWinProbability: item.probability ? item.probability / 100 : null,
              expectedClose: item.expectedClose,
            })),
          }))
          setStages(mapped)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const findStageByItemId = useCallback((itemId: string) => {
    return stages.find((s) => s.items.some((i) => i.id === itemId))
  }, [stages])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    const sourceStage = findStageByItemId(activeId)
    if (!sourceStage) return

    const isOverStage = stages.some((s) => s.id === overId)
    const overStage = isOverStage
      ? stages.find((s) => s.id === overId)
      : findStageByItemId(overId)

    if (!overStage || sourceStage.id === overStage.id) return

    setStages((prev) => {
      const item = prev.find((s) => s.id === sourceStage.id)?.items.find((i) => i.id === activeId)
      if (!item) return prev

      return prev.map((stage) => {
        if (stage.id === sourceStage.id) {
          return { ...stage, items: stage.items.filter((i) => i.id !== activeId) }
        }
        if (stage.id === overStage.id) {
          const alreadyExists = stage.items.some((i) => i.id === activeId)
          if (alreadyExists) return stage
          return { ...stage, items: [...stage.items, { ...item, stageId: overStage.id }] }
        }
        return stage
      })
    })
  }, [findStageByItemId, stages])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveItemId(null)
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    const targetStage = stages.find((s) => s.id === overId) || findStageByItemId(activeId)
    if (!targetStage) return

    fetch('/api/pipeline', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: activeId, stageId: targetStage.id, position: 0 }),
    }).catch(() => {})
  }, [findStageByItemId, stages])
  
  const totalValue = stages.reduce((sum, stage) => 
    sum + stage.items.reduce((s, item) => s + (item.value || 0), 0), 0
  )
  
  return (
    <div className="p-6 space-y-6 bg-[#FEFCF6] min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black">Pipeline</h1>
          <p className="text-gray-500">Drag and drop deals through your sales stages</p>
        </div>
        <div className="flex items-center gap-4">
          <Card className="bg-white border-[#E8E4D9] px-4 py-2 shadow-sm">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#D4AF37]" />
              <span className="text-lg font-semibold text-black">${totalValue.toLocaleString()}</span>
              <span className="text-sm text-gray-500">total</span>
            </div>
          </Card>
          <Button className="btn-gold gap-2">
            <Plus className="w-4 h-4" />
            Add Deal
          </Button>
        </div>
      </div>
      
      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e) => setActiveItemId(String(e.active.id))}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => (
            <div
              key={stage.id}
              className="shrink-0 w-[300px] bg-white rounded-lg border border-[#E8E4D9] shadow-sm"
            >
              {/* Column Header */}
              <div
                className="p-3 border-b border-[#E8E4D9] flex items-center justify-between"
                style={{ borderTopLeftRadius: 8, borderTopRightRadius: 8, borderTop: `3px solid ${stage.color}` }}
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-black">{stage.name}</h3>
                  <Badge variant="secondary" className="bg-[#F8F4E8] text-gray-600">
                    {stage.items.length}
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-[#D4AF37]">
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              
              {/* Column Content */}
              <div className="overflow-y-auto h-[calc(100vh-320px)]">
                <DroppableColumn id={stage.id}>
                  <SortableContext items={stage.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                    {stage.items.map((item) => (
                      <SortableItem key={item.id} item={item} />
                    ))}
                  </SortableContext>
                  
                  {stage.items.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      No deals in this stage
                    </div>
                  )}
                </DroppableColumn>
              </div>
            </div>
          ))}
        </div>
      </DndContext>
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

async function readApiJsonOrText(response: Response): Promise<{ data: any | null; text: string | null }> {
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return { data: await response.json(), text: null }
  }
  return { data: null, text: await response.text() }
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
        const res = await fetch('/api/upload?limit=100')
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
    <div className="p-6 space-y-6 bg-[#FEFCF6] min-h-screen">
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
        <Card className="bg-white border-[#E8E4D9]">
          <CardContent className="p-12 text-center">
            <FileSpreadsheet className="w-12 h-12 text-[#D4AF37]/60 mx-auto mb-4" />
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
          <Card key={upload.id} className="bg-white border-[#E8E4D9] shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-[#D4AF37]/20 flex items-center justify-center">
                    <FileSpreadsheet className="w-6 h-6 text-[#D4AF37]" />
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
                        <Badge variant="outline" className="text-xs border-[#D4AF37]/50 text-[#D4AF37]">
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
      <div className="p-6 space-y-6 bg-[#FEFCF6] min-h-screen">
        <div>
          <h1 className="text-2xl font-bold text-black">Linear Integration</h1>
          <p className="text-gray-500">Connect your Linear workspace to sync issues</p>
        </div>
        <Card className="bg-white border-[#E8E4D9] shadow-sm">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[#5E6AD2]/10 flex items-center justify-center mx-auto">
              <SquareKanban className="w-8 h-8 text-[#5E6AD2]" />
            </div>
            <h3 className="text-lg font-semibold text-black">Linear Not Connected</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Add your Linear API key to the <code className="bg-[#F8F4E8] px-1.5 py-0.5 rounded text-sm">.env</code> file to enable the integration.
              Get your key from <a href="https://linear.app/settings/api" target="_blank" rel="noopener noreferrer" className="text-[#5E6AD2] underline">Linear Settings &rarr; API</a>.
            </p>
            <div className="bg-[#F8F4E8] rounded-lg p-4 text-left max-w-sm mx-auto">
              <p className="text-xs text-gray-500 mb-1">Add to your .env file:</p>
              <code className="text-sm text-black">LINEAR_API_KEY=&quot;lin_api_...&quot;</code>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 bg-[#FEFCF6] min-h-screen">
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
            className="border-[#E8E4D9] text-gray-600 hover:bg-[#F8F4E8] gap-2"
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
          <Card key={stat.title} className="bg-white border-[#E8E4D9] shadow-sm">
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
            <SelectTrigger className="w-[180px] bg-white border-[#E8E4D9]">
              <SelectValue placeholder="Filter by team" />
            </SelectTrigger>
            <SelectContent className="bg-white border-[#E8E4D9]">
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

      <Card className="bg-white border-[#E8E4D9] shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading issues from Linear...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E8E4D9] bg-[#F8F4E8]">
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
                        className="border-b border-[#E8E4D9] hover:bg-[#FEFCF6] transition-colors cursor-pointer"
                        onClick={() => setSelectedIssue(issue)}
                      >
                        <td className="p-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-gray-400">{issue.identifier}</span>
                              {issue.team && (
                                <Badge variant="outline" className="text-xs border-[#E8E4D9] text-gray-500">{issue.team.key}</Badge>
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
        <DialogContent className="bg-white border-[#E8E4D9] max-w-2xl">
          {selectedIssue && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 text-sm text-gray-400 font-mono">
                  {selectedIssue.identifier}
                  {selectedIssue.team && (
                    <Badge variant="outline" className="text-xs border-[#E8E4D9]">{selectedIssue.team.name}</Badge>
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

// Create Linear Issue Dialog
function CreateLinearIssueDialog({
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
    if (prefillTitle) setForm(f => ({ ...f, title: prefillTitle }))
    if (prefillDescription) setForm(f => ({ ...f, description: prefillDescription }))
  }, [prefillTitle, prefillDescription])

  useEffect(() => {
    if (!open) return
    setLoadingTeams(true)
    fetch("/api/linear?action=teams")
      .then((r) => r.json())
      .then((data) => {
        if (data.teams) {
          setTeams(data.teams)
          if (data.teams.length > 0 && !form.teamId) {
            setForm((f) => ({ ...f, teamId: data.teams[0].id }))
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingTeams(false))
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.teamId) return
    setSaving(true)
    try {
      const res = await fetch("/api/linear", {
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
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setForm({ title: "", description: "", teamId: teams[0]?.id ?? "", priority: 0 })
      onOpenChange(false)
    } catch (err) {
      console.error("Failed to create Linear issue:", err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-[#E8E4D9] max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-black flex items-center gap-2">
            <SquareKanban className="w-5 h-5 text-[#5E6AD2]" />
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
              <Select value={form.teamId} onValueChange={(v) => setForm((f) => ({ ...f, teamId: v }))}>
                <SelectTrigger className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]">
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name} ({t.key})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label className="text-gray-600">Title</Label>
            <Input
              className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Issue title"
              required
            />
          </div>
          <div>
            <Label className="text-gray-600">Description</Label>
            <Textarea
              className="mt-1 bg-[#F8F4E8] border-[#E8E4D9] min-h-[80px]"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional description..."
            />
          </div>
          <div>
            <Label className="text-gray-600">Priority</Label>
            <Select value={String(form.priority)} onValueChange={(v) => setForm((f) => ({ ...f, priority: parseInt(v) }))}>
              <SelectTrigger className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]">
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
            <Button type="button" variant="outline" className="border-[#E8E4D9]" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="bg-[#5E6AD2] hover:bg-[#4C56B8] text-white" disabled={saving || !form.teamId}>
              {saving ? "Creating..." : "Create Issue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Placeholder views for other sections
function AutomationView() {
  return (
    <div className="p-6 space-y-6 bg-[#FEFCF6] min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black">AI Automation</h1>
          <p className="text-gray-500">Automate your workflows with intelligent triggers</p>
        </div>
        <Button className="btn-gold gap-2">
          <Plus className="w-4 h-4" />
          Create Automation
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: "Active Automations", value: 12, icon: Zap },
          { title: "Runs This Month", value: 1234, icon: Activity },
          { title: "AI Accuracy", value: "94%", icon: Brain },
        ].map((stat) => (
          <Card key={stat.title} className="bg-white border-[#E8E4D9] shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/20 flex items-center justify-center">
                  <stat.icon className="w-5 h-5 text-[#D4AF37]" />
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
    <div className="p-6 space-y-6 bg-[#FEFCF6] min-h-screen">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black">Social Media</h1>
          <p className="text-gray-500">Elite AI content studio with queue, scheduling, and media prompt generation</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="border-[#D4AF37] text-[#D4AF37] gap-2" onClick={() => setShowMediaDialog(true)}>
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
            className="text-left p-4 bg-white border border-[#E8E4D9] rounded-xl shadow-sm hover:shadow-md transition-shadow"
          >
            <p className="text-sm font-semibold text-black">{pack.label}</p>
            <p className="text-xs text-gray-500 mt-1">{pack.topic}</p>
            <p className="text-xs text-[#8B7355] mt-2">CTA: {pack.cta}</p>
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="bg-white border-[#E8E4D9] shadow-sm xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-black text-lg">Manual Composer</CardTitle>
            <CardDescription>Create, draft, and schedule premium brand posts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-gray-600">Platform</Label>
              <Select value={composerPlatform} onValueChange={setComposerPlatform}>
                <SelectTrigger className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]"><SelectValue /></SelectTrigger>
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
              <Input className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]" value={composerTitle} onChange={(e) => setComposerTitle(e.target.value)} placeholder="Post title (optional)" />
            </div>
            <div>
              <Label className="text-gray-600">Post content</Label>
              <Textarea className="mt-1 min-h-28 bg-[#F8F4E8] border-[#E8E4D9]" value={composerContent} onChange={(e) => setComposerContent(e.target.value)} placeholder="Write a high-converting post..." />
            </div>
            <div>
              <Label className="text-gray-600">Schedule (optional)</Label>
              <Input type="datetime-local" className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]" value={composerScheduleAt} onChange={(e) => setComposerScheduleAt(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 border-[#E8E4D9]"
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

        <Card className="bg-white border-[#E8E4D9] shadow-sm xl:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-black text-lg">Content Queue</CardTitle>
                <CardDescription>Manage drafts, scheduled posts, and published content.</CardDescription>
              </div>
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="w-[180px] bg-[#F8F4E8] border-[#E8E4D9]"><SelectValue /></SelectTrigger>
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
              <div className="py-10 text-center text-gray-500 border border-dashed border-[#E8E4D9] rounded-lg">
                No posts yet. Generate with AI or create your first draft.
              </div>
            ) : filteredItems.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -1 }}
                className="p-4 bg-[#F8F4E8] border border-[#E8E4D9] rounded-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize border-[#D4AF37]/60 text-[#8B7355]">{item.platform}</Badge>
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
                        className="border-[#E8E4D9]"
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
        <DialogContent className="bg-white border-[#E8E4D9] max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-black flex items-center gap-2"><Sparkles className="w-5 h-5 text-[#D4AF37]" />Generate Social Content</DialogTitle>
            <DialogDescription>Create premium content with AI and save directly to queue.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-3">
              <Label className="text-gray-600">Topic</Label>
              <Input className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Life insurance myths families should stop believing" />
            </div>
            <div>
              <Label className="text-gray-600">Platform</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]"><SelectValue /></SelectTrigger>
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
                <SelectTrigger className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]"><SelectValue /></SelectTrigger>
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
              <Input className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]" value={generatedTitle} onChange={(e) => setGeneratedTitle(e.target.value)} />
            </div>
            <div>
              <Label className="text-gray-600">Generated content</Label>
              <Textarea className="mt-1 min-h-32 bg-[#F8F4E8] border-[#E8E4D9]" value={generatedContent} onChange={(e) => setGeneratedContent(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              {generatedHashtags.map((h) => (
                <Badge key={h} variant="outline" className="border-[#E8E4D9]">{h}</Badge>
              ))}
            </div>
            {bestTimeToPost && <p className="text-xs text-gray-500">Best time to post: {bestTimeToPost}</p>}
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              className="border-[#E8E4D9]"
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
        <DialogContent className="bg-white border-[#E8E4D9] max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-black flex items-center gap-2"><ImageIcon className="w-5 h-5 text-[#D4AF37]" />Generate Media Prompt</DialogTitle>
            <DialogDescription>Create image prompts and caption/CTA for high-performing visuals.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-gray-600">Topic</Label>
              <Input className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]" value={mediaTopic} onChange={(e) => setMediaTopic(e.target.value)} placeholder="Family life insurance peace of mind visual" />
            </div>
            <div>
              <Label className="text-gray-600">Platform</Label>
              <Select value={mediaPlatform} onValueChange={setMediaPlatform}>
                <SelectTrigger className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]"><SelectValue /></SelectTrigger>
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
              <Textarea className="mt-1 min-h-24 bg-[#F8F4E8] border-[#E8E4D9]" value={mediaPrompt} onChange={(e) => setMediaPrompt(e.target.value)} />
            </div>
            <div>
              <Label className="text-gray-600">Caption</Label>
              <Textarea className="mt-1 min-h-16 bg-[#F8F4E8] border-[#E8E4D9]" value={mediaCaption} onChange={(e) => setMediaCaption(e.target.value)} />
            </div>
            <div>
              <Label className="text-gray-600">CTA</Label>
              <Input className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]" value={mediaCta} onChange={(e) => setMediaCta(e.target.value)} />
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
    </div>
  )
}

// Elite multi-tenant Settings
const settingsIntegrations = [
  { name: "Linear", status: "connected", icon: SquareKanban, description: "Issue tracking & project management" },
  { name: "Email (SMTP)", status: "connected", icon: Mail, description: "Send and track emails" },
  { name: "Google Calendar", status: "connected", icon: Calendar, description: "Sync meetings and events" },
  { name: "Twilio SMS", status: "disconnected", icon: Phone, description: "SMS campaigns and alerts" },
  { name: "Slack", status: "disconnected", icon: MessageSquare, description: "Deal and lead notifications" },
  { name: "Zapier", status: "disconnected", icon: Zap, description: "Connect 5,000+ apps" },
]
const settingsTeamMembers = [
  { name: "John Doe", email: "john@company.com", role: "Owner", status: "active" },
  { name: "Jane Smith", email: "jane@company.com", role: "Admin", status: "active" },
  { name: "Mike Wilson", email: "mike@company.com", role: "Agent", status: "active" },
]

function CarrierLibrarySettings() {
  type Carrier = { id: string; name: string; slug: string; website?: string | null; _count?: { documents: number } }
  type CarrierDoc = { id: string; type: string; name: string; fileUrl: string; createdAt: string; version?: string | null }

  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [selectedCarrierId, setSelectedCarrierId] = useState<string>('')
  const [documents, setDocuments] = useState<CarrierDoc[]>([])
  const [newCarrierName, setNewCarrierName] = useState('')
  const [newCarrierWebsite, setNewCarrierWebsite] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadType, setUploadType] = useState('brochure')
  const [uploadName, setUploadName] = useState('')
  const [uploadVersion, setUploadVersion] = useState('')
  const [docFilter, setDocFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const underwritingChecklist = [
    'Medical history questionnaire',
    'Prescription history check',
    'Build/height-weight review',
    'Lifestyle risk notes (smoker, aviation, diving)',
    'Financial suitability notes',
  ]

  const loadCarriers = useCallback(async () => {
    const res = await fetch('/api/carriers')
    const data = await res.json()
    if (!data.error) {
      setCarriers(data.carriers || [])
      if (!selectedCarrierId && data.carriers?.[0]?.id) setSelectedCarrierId(data.carriers[0].id)
    }
  }, [selectedCarrierId])

  const loadDocuments = useCallback(async () => {
    if (!selectedCarrierId) {
      setDocuments([])
      return
    }
    const res = await fetch(`/api/carriers/${selectedCarrierId}/documents`)
    const data = await res.json()
    if (!data.error) setDocuments(data.documents || [])
  }, [selectedCarrierId])

  useEffect(() => {
    void loadCarriers()
  }, [loadCarriers])

  useEffect(() => {
    void loadDocuments()
  }, [loadDocuments])

  const createCarrier = async () => {
    if (!newCarrierName.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/carriers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCarrierName, website: newCarrierWebsite }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: 'Carrier added', description: `${newCarrierName} created successfully.` })
      setNewCarrierName('')
      setNewCarrierWebsite('')
      await loadCarriers()
    } catch (error) {
      toast({ title: 'Failed to add carrier', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const uploadDocument = async () => {
    if (!selectedCarrierId || !uploadFile) return
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('type', uploadType)
      formData.append('name', uploadName || uploadFile.name)
      formData.append('version', uploadVersion)
      const res = await fetch(`/api/carriers/${selectedCarrierId}/documents`, { method: 'POST', body: formData })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: 'Document uploaded', description: 'Carrier document saved.' })
      setUploadFile(null)
      setUploadName('')
      setUploadVersion('')
      await loadDocuments()
      await loadCarriers()
    } catch (error) {
      toast({ title: 'Upload failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const selectedCarrier = carriers.find((c) => c.id === selectedCarrierId)
  const filteredDocuments = documents.filter((doc) => docFilter === 'all' || doc.type === docFilter)

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <Card className="bg-white border-[#E8E4D9] shadow-sm">
        <CardHeader>
          <CardTitle className="text-black">Insurance Carriers</CardTitle>
          <CardDescription>Store life/health carriers and underwriting libraries.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input className="bg-[#F8F4E8] border-[#E8E4D9]" placeholder="Carrier name" value={newCarrierName} onChange={(e) => setNewCarrierName(e.target.value)} />
          <Input className="bg-[#F8F4E8] border-[#E8E4D9]" placeholder="Website (optional)" value={newCarrierWebsite} onChange={(e) => setNewCarrierWebsite(e.target.value)} />
          <Button className="btn-gold w-full" onClick={() => void createCarrier()} disabled={loading}>Add Carrier</Button>
          <Separator />
          <div className="p-3 bg-[#F8F4E8] border border-[#E8E4D9] rounded-lg">
            <p className="text-xs font-medium text-black">Broker workflow shortcuts</p>
            <p className="text-xs text-gray-500 mt-1">Store each carrier’s brochure, underwriting guide, and app form with version tracking.</p>
          </div>
          <div className="space-y-2 max-h-[320px] overflow-auto">
            {carriers.map((carrier) => (
              <button
                type="button"
                key={carrier.id}
                onClick={() => setSelectedCarrierId(carrier.id)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border",
                  selectedCarrierId === carrier.id ? "border-[#D4AF37] bg-[#D4AF37]/10" : "border-[#E8E4D9] bg-[#F8F4E8]"
                )}
              >
                <p className="text-sm font-medium text-black">{carrier.name}</p>
                <p className="text-xs text-gray-500">{carrier.website || 'No website'} • {carrier._count?.documents || 0} docs</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border-[#E8E4D9] shadow-sm xl:col-span-2">
        <CardHeader>
          <CardTitle className="text-black">Carrier Document Library</CardTitle>
          <CardDescription>
            {selectedCarrier ? `Upload brochures and underwriting guidelines for ${selectedCarrier.name}.` : 'Select a carrier to manage files.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedCarrier && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <Label className="text-gray-600">Document name</Label>
                <Input className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]" value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="2026 Term Life Brochure" />
              </div>
              <div>
                <Label className="text-gray-600">Type</Label>
                <Select value={uploadType} onValueChange={setUploadType}>
                  <SelectTrigger className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brochure">Brochure</SelectItem>
                    <SelectItem value="underwriting_guidelines">Underwriting Guidelines</SelectItem>
                    <SelectItem value="application">Application</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-600">Version</Label>
                <Input className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]" value={uploadVersion} onChange={(e) => setUploadVersion(e.target.value)} placeholder="v1.0" />
              </div>
              <div className="md:col-span-3">
                <Label className="text-gray-600">File</Label>
                <Input className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]" type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
              </div>
              <div className="flex items-end">
                <Button className="btn-gold w-full" onClick={() => void uploadDocument()} disabled={loading || !uploadFile}>
                  Upload
                </Button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-600">Document filter</Label>
              <Select value={docFilter} onValueChange={setDocFilter}>
                <SelectTrigger className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="brochure">Brochure</SelectItem>
                  <SelectItem value="underwriting_guidelines">Underwriting Guidelines</SelectItem>
                  <SelectItem value="application">Application</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 bg-[#F8F4E8] border border-[#E8E4D9] rounded-lg">
              <p className="text-xs font-medium text-black">Underwriting Prep Checklist</p>
              <div className="mt-1 space-y-1">
                {underwritingChecklist.slice(0, 3).map((item) => (
                  <p key={item} className="text-[11px] text-gray-500">- {item}</p>
                ))}
              </div>
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            {filteredDocuments.length === 0 ? (
              <div className="p-5 border border-dashed border-[#E8E4D9] rounded-lg text-sm text-gray-500">
                No documents yet. Upload brochures and underwriting guidelines here.
              </div>
            ) : filteredDocuments.map((doc) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-[#F8F4E8] border border-[#E8E4D9] rounded-lg flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-black truncate">{doc.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{doc.type.replaceAll('_', ' ')} {doc.version ? `• ${doc.version}` : ''}</p>
                </div>
                <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-sm text-[#D4AF37] hover:underline">Open</a>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SettingsView() {
  const [activeSettingsTab, setActiveSettingsTab] = useState("organization")
  return (
    <div className="p-6 space-y-6 bg-[#FEFCF6] min-h-screen">
      <div>
        <h1 className="text-2xl font-bold text-black">Settings</h1>
        <p className="text-gray-500">Multi-tenant organization, team, security, and integrations</p>
      </div>
      
      <Tabs value={activeSettingsTab} onValueChange={setActiveSettingsTab} className="w-full">
        <TabsList className="bg-[#F8F4E8] border border-[#E8E4D9] p-1 gap-1 flex flex-wrap h-auto">
          <TabsTrigger value="organization" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black gap-2">
            <Building2 className="w-4 h-4" />
            Organization
          </TabsTrigger>
          <TabsTrigger value="team" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black gap-2">
            <Users className="w-4 h-4" />
            Team & roles
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black gap-2">
            <Shield className="w-4 h-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="integrations" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black gap-2">
            <Zap className="w-4 h-4" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="carriers" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black gap-2">
            <FileText className="w-4 h-4" />
            Carriers & Docs
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black gap-2">
            <Webhook className="w-4 h-4" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="billing" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black gap-2">
            <DollarSign className="w-4 h-4" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="audit" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black gap-2">
            <History className="w-4 h-4" />
            Audit log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organization" className="mt-6 space-y-6">
          <Card className="bg-white border-[#E8E4D9] shadow-sm">
            <CardHeader>
              <CardTitle className="text-black">Organization profile</CardTitle>
              <CardDescription>Your workspace identity and plan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-600">Organization name</Label>
                  <Input className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]" defaultValue="Acme Corp" />
                </div>
                <div>
                  <Label className="text-gray-600">URL slug</Label>
                  <Input className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]" defaultValue="acme-corp" />
                </div>
              </div>
              <div>
                <Label className="text-gray-600">Logo URL</Label>
                <Input className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]" placeholder="https://..." />
              </div>
              <div className="flex items-center justify-between p-3 bg-[#F8F4E8] rounded-lg">
                <div>
                  <p className="font-medium text-black">Current plan</p>
                  <p className="text-sm text-gray-500">Pro — 10 team members, 50K leads</p>
                </div>
                <Badge className="bg-[#D4AF37] text-black">Pro</Badge>
              </div>
              <Button className="btn-gold">Save changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="mt-6 space-y-6">
          <Card className="bg-white border-[#E8E4D9] shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-black">Team members</CardTitle>
                  <CardDescription>Roles: Owner, Admin, Agent, Viewer</CardDescription>
                </div>
                <Button className="btn-gold gap-2" size="sm">
                  <UserPlus className="w-4 h-4" />
                  Invite member
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {settingsTeamMembers.map((m) => (
                  <div key={m.email} className="flex items-center justify-between p-3 bg-[#F8F4E8] rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-9 h-9">
                        <AvatarFallback className="bg-[#D4AF37] text-black text-sm">{m.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-black">{m.name}</p>
                        <p className="text-xs text-gray-500">{m.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-[#E8E4D9]">{m.role}</Badge>
                      <Button variant="ghost" size="icon" className="text-gray-400 hover:text-[#D4AF37]"><MoreHorizontal className="w-4 h-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-6 space-y-6">
          <Card className="bg-white border-[#E8E4D9] shadow-sm">
            <CardHeader>
              <CardTitle className="text-black">Security</CardTitle>
              <CardDescription>2FA, sessions, API keys, and password policy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-[#F8F4E8] rounded-lg">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-[#D4AF37]" />
                  <div>
                    <p className="font-medium text-black">Two-factor authentication</p>
                    <p className="text-xs text-gray-500">Recommended for all admins</p>
                  </div>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between p-4 bg-[#F8F4E8] rounded-lg">
                <div className="flex items-center gap-3">
                  <Key className="w-5 h-5 text-[#D4AF37]" />
                  <div>
                    <p className="font-medium text-black">API keys</p>
                    <p className="text-xs text-gray-500">For programmatic access</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="border-[#D4AF37] text-[#D4AF37]">Manage</Button>
              </div>
              <div>
                <Label className="text-gray-600">Session timeout (minutes)</Label>
                <Input type="number" className="mt-1 w-32 bg-[#F8F4E8] border-[#E8E4D9]" defaultValue="60" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-6 space-y-6">
          <Card className="bg-white border-[#E8E4D9] shadow-sm">
            <CardHeader>
              <CardTitle className="text-black">Integrations</CardTitle>
              <CardDescription>Connect email, calendar, SMS, and more</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {settingsIntegrations.map((i) => (
                <div key={i.name} className="flex items-center justify-between p-4 bg-[#F8F4E8] rounded-lg">
                  <div className="flex items-center gap-3">
                    <i.icon className="w-5 h-5 text-[#D4AF37]" />
                    <div>
                      <p className="text-sm font-medium text-black">{i.name}</p>
                      <p className="text-xs text-gray-500">{i.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn(
                      i.status === "connected" && "border-emerald-500 text-emerald-600",
                      i.status === "disconnected" && "border-gray-400 text-gray-500"
                    )}>{i.status}</Badge>
                    <Button variant="outline" size="sm" className="border-[#E8E4D9]">
                      {i.status === "connected" ? "Configure" : "Connect"}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="carriers" className="mt-6 space-y-6">
          <CarrierLibrarySettings />
        </TabsContent>

        <TabsContent value="webhooks" className="mt-6 space-y-6">
          <Card className="bg-white border-[#E8E4D9] shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-black">Webhooks</CardTitle>
                  <CardDescription>Send events to your endpoints</CardDescription>
                </div>
                <Button className="btn-gold gap-2" size="sm">
                  <Plus className="w-4 h-4" />
                  Add webhook
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="p-6 border border-dashed border-[#E8E4D9] rounded-lg text-center text-gray-500 text-sm">
                No webhooks yet. Add one to receive lead.created, deal.won, etc.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="mt-6 space-y-6">
          <Card className="bg-white border-[#E8E4D9] shadow-sm">
            <CardHeader>
              <CardTitle className="text-black">Billing & plan</CardTitle>
              <CardDescription>Usage and subscription</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-[#F8F4E8] rounded-lg">
                  <p className="text-sm text-gray-500">Leads this month</p>
                  <p className="text-2xl font-bold text-black">12,450 / 50,000</p>
                  <Progress value={25} className="mt-2 h-2" />
                </div>
                <div className="p-4 bg-[#F8F4E8] rounded-lg">
                  <p className="text-sm text-gray-500">Team seats</p>
                  <p className="text-2xl font-bold text-black">3 / 10</p>
                </div>
              </div>
              <Button className="btn-gold">Upgrade or change plan</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-6 space-y-6">
          <Card className="bg-white border-[#E8E4D9] shadow-sm">
            <CardHeader>
              <CardTitle className="text-black">Audit log</CardTitle>
              <CardDescription>Recent actions across the organization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { action: "Lead created", user: "John Doe", time: "2 min ago" },
                  { action: "CSV imported", user: "Jane Smith", time: "1 hour ago" },
                  { action: "Deal stage changed", user: "John Doe", time: "2 hours ago" },
                ].map((e, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-[#E8E4D9] last:border-0">
                    <span className="text-sm text-black">{e.action}</span>
                    <span className="text-xs text-gray-500">{e.user} · {e.time}</span>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="mt-4 border-[#E8E4D9] w-full">View full audit log</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Add Lead Dialog - full form
function AddLeadDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    title: '',
    source: 'manual',
    estimatedValue: '',
  })
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to create lead')
      setForm({ firstName: '', lastName: '', email: '', phone: '', company: '', title: '', source: 'manual', estimatedValue: '' })
      onCreated?.()
      onOpenChange(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-[#E8E4D9] max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-black flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#D4AF37]" />
            Add new lead
          </DialogTitle>
          <DialogDescription className="text-gray-500">
            Create a lead manually. AI scoring can run after save.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-600">First name</Label>
              <Input className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="Jane" />
            </div>
            <div>
              <Label className="text-gray-600">Last name</Label>
              <Input className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Doe" />
            </div>
          </div>
          <div>
            <Label className="text-gray-600">Email</Label>
            <Input type="email" className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@company.com" />
          </div>
          <div>
            <Label className="text-gray-600">Phone</Label>
            <Input className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 (555) 000-0000" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-600">Company</Label>
              <Input className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Acme Inc" />
            </div>
            <div>
              <Label className="text-gray-600">Title</Label>
              <Input className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="VP Sales" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-600">Source</Label>
              <Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v }))}>
                <SelectTrigger className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]">
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
              <Input type="number" className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]" value={form.estimatedValue} onChange={e => setForm(f => ({ ...f, estimatedValue: e.target.value }))} placeholder="50000" />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4">
            <Button type="button" variant="outline" className="border-[#E8E4D9]" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="btn-gold" disabled={saving}>{saving ? 'Saving...' : 'Add lead'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Main App
export default function EliteCRM() {
  const [activeView, setActiveView] = useState("dashboard")
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [showAddLeadDialog, setShowAddLeadDialog] = useState(false)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [showLinearIssueDialog, setShowLinearIssueDialog] = useState(false)
  const [linearIssuePrefill, setLinearIssuePrefill] = useState<{ title?: string; description?: string }>({})
  const { sidebarOpen, theme } = useAppStore()
  const [leadsRefreshKey, setLeadsRefreshKey] = useState(0)
  const [uploadsRefreshKey, setUploadsRefreshKey] = useState(0)
  const [showScrapeDialog, setShowScrapeDialog] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [scrapeJobs, setScrapeJobs] = useState<Array<{ id: string; status: string; sourceUrl: string; createdAt: string }>>([])
  const [scrapeForm, setScrapeForm] = useState({
    url: '',
    type: 'website',
    maxPages: 15,
    followLinks: true,
    useHeadless: true,
    delayMs: 500,
    rotateUserAgent: true,
    respectRobots: false,
    proxyEnabled: false,
    proxyProvider: 'none',
    proxyUrlTemplate: '',
  })

  // Command palette keyboard shortcut (Cmd+K)
  useCommandPalette(() => setCommandPaletteOpen(true))

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { title?: string; description?: string }
      setLinearIssuePrefill(detail)
      setShowLinearIssueDialog(true)
    }
    window.addEventListener("create-linear-issue", handler)
    return () => window.removeEventListener("create-linear-issue", handler)
  }, [])
  
  const [uploading, setUploading] = useState(false)

  const loadScrapeJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/scrape?limit=10')
      const data = await res.json()
      if (!data.error) setScrapeJobs(data.jobs || [])
    } catch {
      setScrapeJobs([])
    }
  }, [])

  useEffect(() => {
    void loadScrapeJobs()
  }, [loadScrapeJobs])

  const handleScrapeSubmit = useCallback(async () => {
    if (!scrapeForm.url.trim()) {
      toast({ title: 'URL required', description: 'Enter a website or directory URL to scrape.', variant: 'destructive' })
      return
    }

    setScraping(true)
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: 'Scrape started', description: 'Job queued. Leads will appear as source=scrape.' })
      setShowScrapeDialog(false)
      setScrapeForm((prev) => ({ ...prev, url: '' }))
      setLeadsRefreshKey((k) => k + 1)
      void loadScrapeJobs()
    } catch (error) {
      toast({
        title: 'Scrape failed to start',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setScraping(false)
    }
  }, [loadScrapeJobs, scrapeForm])

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('source', 'csv_upload')
    formData.append('aiAutoScore', 'true')
    try {
      const response = await fetch('/api/upload', { method: 'POST', body: formData })
      const { data: result, text } = await readApiJsonOrText(response)
      if (!result) {
        throw new Error(`Upload API returned non-JSON (${response.status}). ${text?.slice(0, 120) || ''}`.trim())
      }
      if (result.error) throw new Error(result.details ? `${result.error}: ${result.details}` : result.error)
      toast({
        title: "Import complete",
        description: result.message || `Successfully imported ${result.upload?.successfulRows ?? 0} leads`,
      })
      setShowUploadDialog(false)
      setLeadsRefreshKey((k) => k + 1)
      setUploadsRefreshKey((k) => k + 1)
    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }, [])

  const renderView = () => {
    switch (activeView) {
      case "dashboard": return <DashboardView />
      case "leads": return <LeadsView onAddLead={() => setShowAddLeadDialog(true)} onUploadCSV={() => setShowUploadDialog(true)} onScrape={() => setShowScrapeDialog(true)} refreshKey={leadsRefreshKey} />
      case "pipeline": return <PipelineView />
      case "linear": return <LinearView onCreateIssue={() => { setLinearIssuePrefill({}); setShowLinearIssueDialog(true) }} />
      case "uploads": return <UploadsView onUploadCSV={() => setShowUploadDialog(true)} refreshKey={uploadsRefreshKey} />
      case "automation": return <AutomationView />
      case "social": return <SocialMediaView />
      case "settings": return <SettingsView />
      default: return <DashboardView />
    }
  }
  
  return (
    <div className="min-h-screen bg-[#FEFCF6]">
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      <div
        className="transition-all duration-300"
        style={{ marginLeft: sidebarOpen ? 260 : 80 }}
      >
        <Header onAddLead={() => setShowAddLeadDialog(true)} />
        <main className="min-h-[calc(100vh-4rem)]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      
      {/* Add Lead Dialog */}
      <AddLeadDialog
        open={showAddLeadDialog}
        onOpenChange={setShowAddLeadDialog}
        onCreated={() => setLeadsRefreshKey((k) => k + 1)}
      />
      
      {/* Upload CSV Dialog (global) */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="bg-white border-[#E8E4D9] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-black flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#D4AF37]" />
              Import Leads from CSV
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Upload a CSV file to bulk import leads. AI will automatically score each lead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="upload-zone rounded-lg p-8 text-center">
              <FileSpreadsheet className="w-12 h-12 text-[#D4AF37] mx-auto mb-4" />
              <p className="text-sm text-gray-600 mb-2">Drag and drop your CSV file here, or</p>
              <Label htmlFor="global-csv-upload" className="btn-gold cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg">
                <Upload className="w-4 h-4" />
                Browse Files
              </Label>
              <Input
                id="global-csv-upload"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </div>
            <div className="bg-[#F8F4E8] rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-medium text-black">CSV Format Requirements:</h4>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• First row must contain headers</li>
                <li>• Required: Email or Phone</li>
                <li>• Optional: First Name, Last Name, Company, Title</li>
                <li>• Duplicate detection on email/phone</li>
              </ul>
            </div>
            {uploading && (
              <div className="flex items-center justify-center gap-2 text-[#D4AF37]">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-sm">Processing...</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Scrape Leads Dialog */}
      <Dialog open={showScrapeDialog} onOpenChange={setShowScrapeDialog}>
        <DialogContent className="bg-white border-[#E8E4D9] max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-black flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#D4AF37]" />
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
                className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]"
                placeholder="https://example.com/directory"
                value={scrapeForm.url}
                onChange={(e) => setScrapeForm((prev) => ({ ...prev, url: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-gray-600">Type</Label>
                <Select value={scrapeForm.type} onValueChange={(v) => setScrapeForm((prev) => ({ ...prev, type: v }))}>
                  <SelectTrigger className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]"><SelectValue /></SelectTrigger>
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
                  className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]"
                  value={scrapeForm.maxPages}
                  onChange={(e) => setScrapeForm((prev) => ({ ...prev, maxPages: Number(e.target.value) || 15 }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-600">Options</Label>
                <div className="flex items-center justify-between p-2 bg-[#F8F4E8] rounded border border-[#E8E4D9]">
                  <span className="text-xs text-gray-600">Follow links</span>
                  <Switch checked={scrapeForm.followLinks} onCheckedChange={(v) => setScrapeForm((prev) => ({ ...prev, followLinks: v }))} />
                </div>
                <div className="flex items-center justify-between p-2 bg-[#F8F4E8] rounded border border-[#E8E4D9]">
                  <span className="text-xs text-gray-600">Use headless/JS</span>
                  <Switch checked={scrapeForm.useHeadless} onCheckedChange={(v) => setScrapeForm((prev) => ({ ...prev, useHeadless: v }))} />
                </div>
                <div className="flex items-center justify-between p-2 bg-[#F8F4E8] rounded border border-[#E8E4D9]">
                  <span className="text-xs text-gray-600">Rotate user agent</span>
                  <Switch checked={scrapeForm.rotateUserAgent} onCheckedChange={(v) => setScrapeForm((prev) => ({ ...prev, rotateUserAgent: v }))} />
                </div>
                <div className="flex items-center justify-between p-2 bg-[#F8F4E8] rounded border border-[#E8E4D9]">
                  <span className="text-xs text-gray-600">Respect robots.txt</span>
                  <Switch checked={scrapeForm.respectRobots} onCheckedChange={(v) => setScrapeForm((prev) => ({ ...prev, respectRobots: v }))} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-gray-600">Delay between requests (ms)</Label>
                <Input
                  type="number"
                  min={0}
                  max={10000}
                  className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]"
                  value={scrapeForm.delayMs}
                  onChange={(e) => setScrapeForm((prev) => ({ ...prev, delayMs: Number(e.target.value) || 0 }))}
                />
              </div>
              <div className="flex items-end">
                <div className="flex items-center justify-between p-2 bg-[#F8F4E8] rounded border border-[#E8E4D9] w-full">
                  <span className="text-xs text-gray-600">Enable proxy provider</span>
                  <Switch checked={scrapeForm.proxyEnabled} onCheckedChange={(v) => setScrapeForm((prev) => ({ ...prev, proxyEnabled: v }))} />
                </div>
              </div>
              <div>
                <Label className="text-gray-600">Proxy provider</Label>
                <Select value={scrapeForm.proxyProvider} onValueChange={(v) => setScrapeForm((prev) => ({ ...prev, proxyProvider: v }))}>
                  <SelectTrigger className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="scrapingbee">ScrapingBee</SelectItem>
                    <SelectItem value="proxy_template">Proxy template URL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {scrapeForm.proxyEnabled && scrapeForm.proxyProvider === 'proxy_template' && (
              <div>
                <Label className="text-gray-600">Proxy template URL</Label>
                <Input
                  className="mt-1 bg-[#F8F4E8] border-[#E8E4D9]"
                  placeholder="https://my-proxy.example.com?url={url}"
                  value={scrapeForm.proxyUrlTemplate}
                  onChange={(e) => setScrapeForm((prev) => ({ ...prev, proxyUrlTemplate: e.target.value }))}
                />
                <p className="text-xs text-gray-500 mt-1">Use <code>{'{url}'}</code> placeholder where the target URL should be injected.</p>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" className="border-[#E8E4D9]" onClick={() => setShowScrapeDialog(false)}>Cancel</Button>
              <Button className="btn-gold" onClick={() => void handleScrapeSubmit()} disabled={scraping}>
                {scraping ? 'Starting...' : 'Start Scrape'}
              </Button>
            </DialogFooter>

            <Separator />
            <div>
              <p className="text-sm font-medium text-black mb-2">Recent scrape jobs</p>
              <div className="space-y-2 max-h-40 overflow-auto">
                {scrapeJobs.length === 0 ? (
                  <p className="text-xs text-gray-500">No jobs yet.</p>
                ) : scrapeJobs.map((job) => (
                  <div key={job.id} className="p-2 bg-[#F8F4E8] border border-[#E8E4D9] rounded flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-black truncate">{job.sourceUrl}</p>
                      <p className="text-[11px] text-gray-500">{new Date(job.createdAt).toLocaleString()}</p>
                    </div>
                    <Badge variant="outline" className={cn(
                      job.status === 'completed' && 'border-emerald-500 text-emerald-600',
                      job.status === 'running' && 'border-blue-500 text-blue-600',
                      job.status === 'failed' && 'border-red-500 text-red-600'
                    )}>
                      {job.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Create Linear Issue Dialog */}
      <CreateLinearIssueDialog
        open={showLinearIssueDialog}
        onOpenChange={setShowLinearIssueDialog}
        prefillTitle={linearIssuePrefill.title}
        prefillDescription={linearIssuePrefill.description}
      />
      
      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onNavigate={setActiveView}
        onAddLead={() => setShowAddLeadDialog(true)}
        onUploadCSV={() => setShowUploadDialog(true)}
      />
    </div>
  )
}
