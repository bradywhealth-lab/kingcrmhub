"use client"

import { Bell, Bot, CheckSquare, LayoutDashboard, LogOut, Menu, MessageSquare, Moon, Plus, Search, Settings, Share2, Sparkles, Sun, Users, X, Zap, GitBranch, ChevronDown } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/lib/store"

const mockNotifications: Array<{ id: string; title: string; body: string; time: string; unread: boolean }> = []

// Freelancer-native IA. `id`s match the DashboardView router in src/app/page.tsx.
export const APP_NAV_ITEMS = [
  { id: "dashboard", icon: LayoutDashboard, label: "Home" },
  { id: "leads", icon: Users, label: "Clients" },
  { id: "pipeline", icon: GitBranch, label: "Pipeline" },
  { id: "tasks", icon: CheckSquare, label: "Work" },
  { id: "automation", icon: Zap, label: "Automations" },
  { id: "assistant", icon: MessageSquare, label: "Assistant" },
  { id: "prompts", icon: Sparkles, label: "Prompts" },
  { id: "social", icon: Share2, label: "Social" },
] as const

const PRIMARY_COUNT = 6

function getInitials(name: string | null | undefined) {
  if (!name) return "KC"
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()
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
  const { theme, setTheme } = useAppStore()
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const unreadCount = useMemo(() => mockNotifications.filter((n) => n.unread).length, [])

  // Apply the Regal dark theme by toggling `.dark` on <html>.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [theme])

  const primary = APP_NAV_ITEMS.slice(0, PRIMARY_COUNT)
  const overflow = APP_NAV_ITEMS.slice(PRIMARY_COUNT)
  const activeItem = APP_NAV_ITEMS.find((i) => i.id === activeView)

  const navigate = (view: string) => {
    setActiveView(view)
    setMobileNavOpen(false)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ===== TOP NAVIGATION ===== */}
      <header className="sticky top-0 z-40 bg-[var(--ink)] text-white">
        <div className="flex h-[60px] items-center gap-3 px-4 sm:px-6">
          {/* Logo */}
          <button onClick={() => navigate("dashboard")} className="mr-2 shrink-0 font-display text-xl font-extrabold tracking-tight text-white">
            KING<span className="text-[var(--accent-solid)]">.</span>
          </button>

          {/* Desktop pill nav */}
          <nav className="hidden items-center gap-1 lg:flex">
            {primary.map((item) => {
              const active = activeView === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                    active ? "bg-[var(--accent-solid)] text-white" : "text-white/60 hover:text-white hover:bg-white/5"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              )
            })}
            {overflow.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={cn(
                    "flex items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                    overflow.some((o) => o.id === activeView) ? "bg-[var(--accent-solid)] text-white" : "text-white/60 hover:text-white hover:bg-white/5"
                  )}>
                    More <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                  {overflow.map((item) => (
                    <DropdownMenuItem key={item.id} onClick={() => navigate(item.id)} className="cursor-pointer gap-2">
                      <item.icon className="h-4 w-4" /> {item.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem onClick={() => navigate("settings")} className="cursor-pointer gap-2">
                    <Settings className="h-4 w-4" /> Settings
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </nav>

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen((v) => !v)}
            className="ml-auto h-10 w-10 rounded-xl text-white/80 hover:bg-white/10 hover:text-white lg:hidden"
          >
            {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          {/* Right cluster */}
          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <div className="relative w-[220px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <div className="flex h-9 items-center rounded-xl border border-white/15 bg-white/5 pl-9 pr-2 text-sm text-white/50">
                Search
                <kbd className="ml-auto rounded border border-white/15 px-1.5 py-0.5 font-mono text-[11px] text-white/40">⌘K</kbd>
              </div>
            </div>
            <ThemeToggle theme={theme} setTheme={setTheme} />
            <NotificationsBell open={notificationsOpen} setOpen={setNotificationsOpen} unreadCount={unreadCount} />
            <Button onClick={onAddLead} className="h-9 gap-2 rounded-xl bg-[var(--accent-solid)] px-4 font-semibold text-white hover:bg-[var(--accent-hover)]">
              <Plus className="h-4 w-4" /> New
            </Button>
            <UserMenu currentUser={currentUser} onSignOut={onSignOut} onSettings={() => navigate("settings")} />
          </div>

          {/* Mobile right cluster (compact) */}
          <div className="flex items-center gap-1.5 lg:hidden">
            <ThemeToggle theme={theme} setTheme={setTheme} />
            <Button onClick={onAddLead} size="icon" aria-label="New" className="h-9 w-9 rounded-xl bg-[var(--accent-solid)] text-white hover:bg-[var(--accent-hover)]">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile nav drawer */}
        <AnimatePresence>
          {mobileNavOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden border-t border-white/10 lg:hidden"
            >
              <div className="grid grid-cols-2 gap-1.5 p-3">
                {APP_NAV_ITEMS.map((item) => {
                  const active = activeView === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.id)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                        active ? "bg-[var(--accent-solid)] text-white" : "text-white/70 hover:bg-white/8"
                      )}
                    >
                      <item.icon className="h-4 w-4" /> {item.label}
                    </button>
                  )
                })}
                <button onClick={() => navigate("settings")} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/8">
                  <Settings className="h-4 w-4" /> Settings
                </button>
                <button onClick={onSignOut} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/8">
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="min-h-[calc(100vh-60px)]">{children}</main>
    </div>
  )
}

function ThemeToggle({ theme, setTheme }: { theme: "dark" | "light"; setTheme: (t: "dark" | "light") => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="h-9 w-9 rounded-xl border border-white/15 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}

function NotificationsBell({ open, setOpen, unreadCount }: { open: boolean; setOpen: (v: boolean) => void; unreadCount: number }) {
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-xl border border-white/15 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--accent-solid)]" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && <Badge className="border-0 bg-[var(--accent-soft)] text-[var(--accent-text)]">{unreadCount}</Badge>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-3 py-6 text-center text-sm text-muted-foreground">You're all caught up.</div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function UserMenu({ currentUser, onSignOut, onSettings }: { currentUser: AppShellUser; onSignOut: () => void; onSettings: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1 rounded-xl p-0.5 pr-1.5 transition-colors hover:bg-white/8">
          <Avatar className="h-9 w-9 rounded-xl border border-white/10">
            <AvatarFallback className="rounded-xl bg-[var(--accent-solid)] text-sm font-semibold text-white">{getInitials(currentUser?.name)}</AvatarFallback>
          </Avatar>
          <ChevronDown className="h-3.5 w-3.5 text-white/50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="px-2 py-2">
          <p className="truncate text-sm font-semibold text-foreground">{currentUser?.name || "Workspace User"}</p>
          <p className="truncate text-xs capitalize text-muted-foreground">{currentUser?.role || "member"}</p>
          {currentUser?.organization && (
            <div className="mt-2 rounded-lg bg-muted p-2">
              <p className="truncate text-xs font-medium text-foreground">{currentUser.organization.name}</p>
              <Badge className="mt-1 border-0 bg-[var(--accent-soft)] capitalize text-[var(--accent-text)]">{currentUser.organization.plan}</Badge>
            </div>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSettings} className="cursor-pointer gap-2"><Settings className="h-4 w-4" /> Settings</DropdownMenuItem>
        <DropdownMenuItem onClick={onSignOut} className="cursor-pointer gap-2 text-destructive focus:text-destructive"><LogOut className="h-4 w-4" /> Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

type AppShellUser = { name: string | null; role: string; organization?: { name: string; plan: string } } | null
