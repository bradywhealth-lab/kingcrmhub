"use client"

import { LayoutDashboard, Users, GitBranch, CheckSquare, MoreHorizontal, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

const MOBILE_TABS = [
  { id: "dashboard", icon: LayoutDashboard, label: "Home" },
  { id: "leads", icon: Users, label: "Clients" },
  { id: "pipeline", icon: GitBranch, label: "Pipeline" },
  { id: "tasks", icon: CheckSquare, label: "Tasks" },
] as const

interface MobileTabBarProps {
  activeView: string
  onNavigate: (view: string) => void
  onAddLead: () => void
  onMore: () => void
}

export function MobileTabBar({ activeView, onNavigate, onAddLead, onMore }: MobileTabBarProps) {
  return (
    <>
      {/* FAB — add lead/task */}
      <button
        onClick={onAddLead}
        className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--teal)] text-[var(--ink)] shadow-[0_8px_24px_rgba(24,184,151,0.35)] active:scale-95 transition-transform md:hidden"
        aria-label="Add lead"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-[rgba(31,42,54,0.08)] bg-[rgba(252,252,252,0.92)] backdrop-blur-xl pb-[env(safe-area-inset-bottom,0px)] md:hidden">
        {MOBILE_TABS.map((tab) => {
          const isActive = activeView === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              className={cn(
                "flex min-h-[48px] min-w-[48px] flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors",
                isActive ? "text-[var(--teal)]" : "text-[#0c111b]/50",
              )}
            >
              <tab.icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className={cn("text-[10px] font-medium", isActive && "font-semibold")}>
                {tab.label}
              </span>
            </button>
          )
        })}
        <button
          onClick={onMore}
          className="flex min-h-[48px] min-w-[48px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[#0c111b]/50 transition-colors"
        >
          <MoreHorizontal className="h-5 w-5" />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </nav>
    </>
  )
}