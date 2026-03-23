"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Bell,
  Bot,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Share2,
  SquareKanban,
  Upload,
  Users,
  X,
  Zap,
} from "lucide-react"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"

const mockNotifications = [
  { id: "1", title: "New lead assigned", body: "Sarah Johnson from TechCorp was assigned to you", time: "2m ago", unread: true },
  { id: "2", title: "Deal won", body: "James Wilson - Creative Agency closed at $120K", time: "1h ago", unread: true },
  { id: "3", title: "AI insight ready", body: "3 leads haven't been contacted in 7+ days", time: "3h ago", unread: false },
]

function Sidebar({
  activeView,
  setActiveView,
  currentUser,
}: {
  activeView: string
  setActiveView: (view: string) => void
  currentUser: { name: string | null; role: string } | null
}) {
  const { sidebarOpen, setSidebarOpen } = useAppStore()

  const menuItems = [
    { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { id: "leads", icon: Users, label: "Leads" },
    { id: "pipeline", icon: GitBranch, label: "Pipeline" },
    { id: "uploads", icon: Upload, label: "CSV Uploads" },
    { id: "linear", icon: SquareKanban, label: "Linear" },
    { id: "automation", icon: Zap, label: "AI Automation" },
    { id: "assistant", icon: MessageSquare, label: "AI Assistant" },
    { id: "social", icon: Share2, label: "Social Media" },
    { id: "settings", icon: Settings, label: "Settings" },
  ]

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarOpen ? 260 : 80 }}
      className="fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-[#334155] bg-[#0F172A]"
    >
      <div className="flex h-16 items-center justify-between border-b border-[#334155] px-4">
        <AnimatePresence mode="wait">
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-linear-to-br from-[#2563EB] to-[#14B8A6]">
                <Bot className="h-5 w-5 text-black" />
              </div>
              <span className="text-xl font-bold text-white">Elite<span className="text-[#2563EB]">CRM</span></span>
            </motion.div>
          )}
        </AnimatePresence>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-gray-400 hover:bg-[#1E293B] hover:text-white"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200",
              activeView === item.id
                ? "border-l-2 border-[#2563EB] bg-linear-to-r from-[#2563EB]/20 to-transparent text-[#2563EB]"
                : "text-gray-400 hover:bg-[#1E293B] hover:text-white",
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <AnimatePresence mode="wait">
              {sidebarOpen && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="whitespace-nowrap text-sm font-medium"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        ))}
      </nav>

      <div className="border-t border-[#334155] p-3">
        <div className={cn("flex items-center gap-3 rounded-lg bg-[#1E293B] p-2", !sidebarOpen && "justify-center")}>
          <Avatar className="h-9 w-9 border-2 border-[#2563EB]">
            <AvatarFallback className="bg-[#2563EB] font-semibold text-black">JD</AvatarFallback>
          </Avatar>
          <AnimatePresence mode="wait">
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="min-w-0 flex-1"
              >
                <p className="truncate text-sm font-medium text-white">{currentUser?.name || "Workspace User"}</p>
                <p className="truncate text-xs capitalize text-[#2563EB]">{currentUser?.role || "member"}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  )
}

function Header({
  onAddLead,
  onSignOut,
}: {
  onAddLead: () => void
  onSignOut: () => void
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const unreadCount = mockNotifications.filter((notification) => notification.unread).length

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#D7DFEA] bg-white/80 px-6 backdrop-blur-sm">
      <div className="flex flex-1 items-center gap-4">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search leads, deals, contacts..."
            className="border-[#D7DFEA] bg-[#EEF2F7] pl-10 focus:border-[#2563EB] focus:ring-[#2563EB]"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative text-gray-500 hover:bg-[#F5F7FB] hover:text-[#2563EB]"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#2563EB]" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 border-[#D7DFEA] bg-white">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Notifications</span>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="bg-[#2563EB]/20 text-[#0EA5E9]">
                  {unreadCount}
                </Badge>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {mockNotifications.map((notification) => (
              <DropdownMenuItem key={notification.id} className="flex cursor-pointer flex-col items-start gap-0.5 p-3">
                <span className={cn("text-sm font-medium text-black", notification.unread && "font-semibold")}>
                  {notification.title}
                </span>
                <span className="text-xs text-gray-500">{notification.body}</span>
                <span className="text-xs text-gray-400">{notification.time}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-center font-medium text-[#2563EB]" onSelect={() => setNotificationsOpen(false)}>
              Mark all as read
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button className="btn-gold gap-2" onClick={onAddLead}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Lead</span>
        </Button>
        <Button variant="outline" size="icon" className="border-[#D7DFEA]" onClick={onSignOut}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}

export function AppChrome({
  activeView,
  setActiveView,
  currentUser,
  onAddLead,
  onSignOut,
  children,
}: {
  activeView: string
  setActiveView: (view: string) => void
  currentUser: { name: string | null; role: string } | null
  onAddLead: () => void
  onSignOut: () => void
  children: React.ReactNode
}) {
  const { sidebarOpen } = useAppStore()

  return (
    <div className="min-h-screen bg-[#F5F7FB]">
      <Sidebar activeView={activeView} setActiveView={setActiveView} currentUser={currentUser} />
      <div className="transition-all duration-300" style={{ marginLeft: sidebarOpen ? 260 : 80 }}>
        <Header onAddLead={onAddLead} onSignOut={onSignOut} />
        <main className="min-h-[calc(100vh-4rem)]">{children}</main>
      </div>
    </div>
  )
}
