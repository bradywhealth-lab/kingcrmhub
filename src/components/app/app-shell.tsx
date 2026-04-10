"use client"

import { Bell, Bot, LayoutDashboard, LogOut, Menu, MessageSquare, Plus, Search, Settings, Share2, SquareKanban, Upload, Users, X, Zap, GitBranch } from "lucide-react"
import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/lib/store"

const mockNotifications = [
  { id: "1", title: "New lead assigned", body: "Sarah Johnson from TechCorp was assigned to you", time: "2m ago", unread: true },
  { id: "2", title: "Deal won", body: "James Wilson - Creative Agency closed at $120K", time: "1h ago", unread: true },
  { id: "3", title: "AI insight ready", body: "3 leads haven't been contacted in 7+ days", time: "3h ago", unread: false },
]

export const APP_NAV_ITEMS = [
  { id: "dashboard", icon: LayoutDashboard, label: "Dashboard", short: "Overview" },
  { id: "leads", icon: Users, label: "Leads", short: "Leads" },
  { id: "pipeline", icon: GitBranch, label: "Pipeline", short: "Deals" },
  { id: "uploads", icon: Upload, label: "CSV Uploads", short: "Imports" },
  { id: "linear", icon: SquareKanban, label: "Linear", short: "Issues" },
  { id: "automation", icon: Zap, label: "AI Automation", short: "Automations" },
  { id: "assistant", icon: MessageSquare, label: "AI Assistant", short: "Assistant" },
  { id: "social", icon: Share2, label: "Social Media", short: "Social" },
  { id: "settings", icon: Settings, label: "Settings", short: "Settings" },
] as const

function getInitials(name: string | null | undefined) {
  if (!name) return "KC"
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function AppShell({
  activeView,
  setActiveView,
  currentUser,
  onAddLead,
  onSignOut,
  children,
}: {
  activeView: string
  setActiveView: (view: string) => void
  currentUser: { name: string | null; role: string; organization?: { name: string; plan: string } } | null
  onAddLead: () => void
  onSignOut: () => void
  children: React.ReactNode
}) {
  const { sidebarOpen, setSidebarOpen } = useAppStore()
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const unreadCount = useMemo(() => mockNotifications.filter((notification) => notification.unread).length, [])

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8f4e8_0%,#eef3fb_48%,#f8f4e8_100%)] text-[#1f2a36]">
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 288 : 88 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-white/10 bg-[#0f172a] shadow-[24px_0_60px_rgba(15,23,42,0.16)]"
      >
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-4">
          <AnimatePresence mode="wait">
            {sidebarOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#557df5,#3a5fd9)] shadow-[0_10px_30px_rgba(85,125,245,0.35)]">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/55">King CRM Hub</p>
                  <p className="text-lg font-semibold text-white">Operator Console</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="text-white/65 hover:bg-white/8 hover:text-white">
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        <div className="px-4 pt-5">
          <div className={cn("rounded-2xl border border-white/10 bg-white/5 p-4 text-white", !sidebarOpen && "px-2 py-3") }>
            <AnimatePresence mode="wait">
              {sidebarOpen ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border border-white/10 bg-white/10">
                      <AvatarFallback className="bg-[#557df5] text-sm font-semibold text-white">{getInitials(currentUser?.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{currentUser?.name || "Workspace User"}</p>
                      <p className="truncate text-xs capitalize text-white/55">{currentUser?.role || "member"}</p>
                    </div>
                  </div>
                  <div className="rounded-xl bg-[linear-gradient(135deg,rgba(85,125,245,0.16),rgba(255,255,255,0.02))] p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Organization</p>
                    <p className="mt-1 text-sm font-medium text-white">{currentUser?.organization?.name || "King CRM workspace"}</p>
                    <Badge className="mt-2 border-0 bg-white/10 text-white/75">{currentUser?.organization?.plan || "Pro"}</Badge>
                  </div>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-center">
                  <Avatar className="h-11 w-11 border border-white/10 bg-white/10">
                    <AvatarFallback className="bg-[#557df5] text-sm font-semibold text-white">{getInitials(currentUser?.name)}</AvatarFallback>
                  </Avatar>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <nav className="flex-1 space-y-2 px-3 py-5 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          {APP_NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={cn(
                "group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all duration-200",
                activeView === item.id
                  ? "bg-[linear-gradient(90deg,rgba(85,125,245,0.24),rgba(85,125,245,0.08))] text-white shadow-[0_12px_28px_rgba(85,125,245,0.15)]"
                  : "text-white/62 hover:bg-white/6 hover:text-white"
              )}
            >
              <div className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors",
                activeView === item.id ? "border-[#557df5]/60 bg-[#557df5]/18" : "border-white/8 bg-white/4 group-hover:border-white/16"
              )}>
                <item.icon className="h-4 w-4" />
              </div>
              <AnimatePresence mode="wait">
                {sidebarOpen && (
                  <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} className="min-w-0 overflow-hidden">
                    <p className="truncate text-sm font-medium">{item.label}</p>
                    <p className="truncate text-xs text-white/42">{item.short}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <Button variant="ghost" onClick={onSignOut} className={cn("w-full rounded-2xl border border-white/10 bg-white/4 text-white/72 hover:bg-white/8 hover:text-white", !sidebarOpen && "px-0")}>
            <LogOut className="h-4 w-4" />
            {sidebarOpen && <span className="ml-2">Sign out</span>}
          </Button>
        </div>
      </motion.aside>

      <div className="transition-all duration-150 ease-out" style={{ marginLeft: sidebarOpen ? 288 : 88 }}>
        <header className="sticky top-0 z-30 border-b border-[rgba(31,42,54,0.08)] bg-[rgba(252,252,252,0.82)] backdrop-blur-xl">
          <div className="flex min-h-20 items-center justify-between gap-4 px-6 py-4 lg:px-8">
            <div className="flex flex-1 items-center gap-4">
              <div className="hidden min-w-0 lg:block">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1f2a36]/45">Workspace command center</p>
                <h1 className="truncate text-xl font-semibold text-[#1f2a36]">{APP_NAV_ITEMS.find((item) => item.id === activeView)?.label || "Dashboard"}</h1>
              </div>
              <div className="relative ml-auto w-full max-w-xl">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1f2a36]/35" />
                <Input placeholder="Search leads, tasks, campaigns, or notes..." className="h-12 rounded-2xl border-[rgba(31,42,54,0.08)] bg-white pl-11 shadow-[0_8px_24px_rgba(31,42,54,0.05)] focus-visible:ring-[#557df5]/30" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative h-11 w-11 rounded-2xl border border-[rgba(31,42,54,0.08)] bg-white text-[#1f2a36]/70 shadow-sm hover:bg-[#f6f9ff] hover:text-[#557df5]">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#557df5]" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 rounded-2xl border-[rgba(31,42,54,0.08)] bg-white p-1 shadow-[0_18px_48px_rgba(31,42,54,0.12)]">
                  <DropdownMenuLabel className="flex items-center justify-between px-3 py-2">
                    <span className="text-sm font-semibold text-[#1f2a36]">Notifications</span>
                    {unreadCount > 0 && <Badge className="border-0 bg-[#557df5]/12 text-[#557df5]">{unreadCount}</Badge>}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {mockNotifications.map((notification) => (
                    <DropdownMenuItem key={notification.id} className="flex cursor-pointer flex-col items-start gap-0.5 rounded-xl p-3">
                      <span className={cn("text-sm text-[#1f2a36]", notification.unread && "font-semibold")}>{notification.title}</span>
                      <span className="text-xs text-[#1f2a36]/55">{notification.body}</span>
                      <span className="text-[11px] text-[#1f2a36]/35">{notification.time}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button onClick={onAddLead} className="h-12 rounded-2xl bg-[linear-gradient(135deg,#557df5,#3a5fd9)] px-5 text-white shadow-[0_12px_28px_rgba(85,125,245,0.28)] hover:opacity-95">
                <Plus className="mr-2 h-4 w-4" />
                Add lead
              </Button>
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-5rem)] px-0 pb-10">{children}</main>
      </div>
    </div>
  )
}
