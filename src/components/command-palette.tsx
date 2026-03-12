"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search, ArrowRight, Sparkles, Users, GitBranch, Settings,
  Plus, FileUp, Download, Bell, Moon, Sun, HelpCircle,
  LayoutDashboard, Mail, Phone, Calendar, BarChart3,
  Zap, Brain, MessageSquare, FileText, Tag, Filter
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

// Command Types
interface CommandAction {
  id: string
  title: string
  description?: string
  icon: React.ElementType
  shortcut?: string[]
  category: string
  action: () => void
  keywords?: string[]
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (view: string) => void
  onAddLead: () => void
  onUploadCSV: () => void
}

export function CommandPalette({ 
  open, 
  onOpenChange, 
  onNavigate, 
  onAddLead, 
  onUploadCSV 
}: CommandPaletteProps) {
  const [search, setSearch] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  
  // Define all commands
  const commands: CommandAction[] = [
    // Navigation
    {
      id: "nav-dashboard",
      title: "Go to Dashboard",
      description: "View your main dashboard",
      icon: LayoutDashboard,
      shortcut: ["G", "D"],
      category: "Navigation",
      action: () => { onNavigate("dashboard"); onOpenChange(false) },
      keywords: ["home", "main", "overview"]
    },
    {
      id: "nav-leads",
      title: "Go to Leads",
      description: "Manage your leads",
      icon: Users,
      shortcut: ["G", "L"],
      category: "Navigation",
      action: () => { onNavigate("leads"); onOpenChange(false) },
      keywords: ["contacts", "prospects", "customers"]
    },
    {
      id: "nav-pipeline",
      title: "Go to Pipeline",
      description: "View your sales pipeline",
      icon: GitBranch,
      shortcut: ["G", "P"],
      category: "Navigation",
      action: () => { onNavigate("pipeline"); onOpenChange(false) },
      keywords: ["deals", "kanban", "board"]
    },
    {
      id: "nav-automation",
      title: "Go to AI Automation",
      description: "Manage automations",
      icon: Zap,
      shortcut: ["G", "A"],
      category: "Navigation",
      action: () => { onNavigate("automation"); onOpenChange(false) },
      keywords: ["workflows", "triggers"]
    },
    {
      id: "nav-settings",
      title: "Go to Settings",
      description: "Configure your CRM",
      icon: Settings,
      shortcut: ["G", "S"],
      category: "Navigation",
      action: () => { onNavigate("settings"); onOpenChange(false) },
      keywords: ["preferences", "config"]
    },
    
    // Actions
    {
      id: "action-add-lead",
      title: "Add New Lead",
      description: "Create a new lead manually",
      icon: Plus,
      shortcut: ["N", "L"],
      category: "Actions",
      action: () => { onAddLead(); onOpenChange(false) },
      keywords: ["create", "new", "contact"]
    },
    {
      id: "action-upload-csv",
      title: "Import CSV",
      description: "Bulk import leads from CSV",
      icon: FileUp,
      shortcut: ["I", "C"],
      category: "Actions",
      action: () => { onUploadCSV(); onOpenChange(false) },
      keywords: ["upload", "import", "bulk"]
    },
    {
      id: "action-export",
      title: "Export Leads",
      description: "Download leads as CSV",
      icon: Download,
      shortcut: ["E", "L"],
      category: "Actions",
      action: () => { onOpenChange(false) },
      keywords: ["download", "backup"]
    },
    
    // AI Features
    {
      id: "ai-score",
      title: "AI Score All Leads",
      description: "Run AI scoring on all leads",
      icon: Brain,
      shortcut: ["A", "S"],
      category: "AI Features",
      action: () => { onOpenChange(false) },
      keywords: ["score", "qualify", "analyze"]
    },
    {
      id: "ai-email",
      title: "Generate Email Template",
      description: "AI creates email templates",
      icon: Mail,
      shortcut: ["A", "E"],
      category: "AI Features",
      action: () => { onOpenChange(false) },
      keywords: ["template", "write", "draft"]
    },
    {
      id: "ai-insights",
      title: "Generate AI Insights",
      description: "Analyze pipeline and get recommendations",
      icon: Sparkles,
      shortcut: ["A", "I"],
      category: "AI Features",
      action: () => { onOpenChange(false) },
      keywords: ["analyze", "predict", "recommend"]
    },
    {
      id: "ai-content",
      title: "Generate Social Content",
      description: "Create social media posts with AI",
      icon: MessageSquare,
      shortcut: ["A", "C"],
      category: "AI Features",
      action: () => { onNavigate("social"); onOpenChange(false) },
      keywords: ["social", "post", "linkedin", "twitter"]
    },
    
    // Quick Actions
    {
      id: "quick-search",
      title: "Advanced Search",
      description: "Search with filters",
      icon: Filter,
      shortcut: ["/"],
      category: "Quick Actions",
      action: () => { onOpenChange(false) },
      keywords: ["find", "filter", "query"]
    },
    {
      id: "quick-notifications",
      title: "View Notifications",
      description: "Check your alerts",
      icon: Bell,
      shortcut: ["N"],
      category: "Quick Actions",
      action: () => { onOpenChange(false) },
      keywords: ["alerts", "updates"]
    },
    
    // Help
    {
      id: "help-shortcuts",
      title: "Keyboard Shortcuts",
      description: "View all shortcuts",
      icon: HelpCircle,
      shortcut: ["?"],
      category: "Help",
      action: () => { onOpenChange(false) },
      keywords: ["help", "guide", "keys"]
    },
  ]
  
  // Filter commands based on search
  const filteredCommands = commands.filter(cmd => {
    const searchLower = search.toLowerCase()
    return (
      cmd.title.toLowerCase().includes(searchLower) ||
      cmd.description?.toLowerCase().includes(searchLower) ||
      cmd.keywords?.some(kw => kw.includes(searchLower)) ||
      cmd.category.toLowerCase().includes(searchLower)
    )
  })
  
  // Group commands by category
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = []
    acc[cmd.category].push(cmd)
    return acc
  }, {} as Record<string, CommandAction[]>)
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return
      
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
      } else if (e.key === "Enter") {
        e.preventDefault()
        const flatCommands = Object.values(groupedCommands).flat()
        if (flatCommands[selectedIndex]) {
          flatCommands[selectedIndex].action()
        }
      }
    }
    
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, selectedIndex, filteredCommands, groupedCommands])
  
  // Reset on open - use requestAnimationFrame to avoid setState in effect
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        setSearch("")
        setSelectedIndex(0)
      })
    }
  }, [open])
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white/95 backdrop-blur-xl border-[#E8E4D9] p-0 max-w-2xl shadow-2xl rounded-2xl overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-[#E8E4D9]">
          <Search className="w-5 h-5 text-[#D4AF37]" />
          <input
            type="text"
            placeholder="Type a command or search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-black placeholder:text-gray-400 outline-none text-lg"
            autoFocus
          />
          <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-400 bg-[#F8F4E8] rounded border border-[#E8E4D9]">
            esc
          </kbd>
        </div>
        
        {/* Commands List */}
        <ScrollArea className="max-h-[400px]">
          <div className="p-2">
            {Object.entries(groupedCommands).map(([category, cmds], catIdx) => (
              <div key={category}>
                {catIdx > 0 && <Separator className="my-2 bg-[#E8E4D9]" />}
                <div className="px-2 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {category}
                </div>
                {cmds.map((cmd, idx) => {
                  const globalIndex = filteredCommands.indexOf(cmd)
                  return (
                    <motion.button
                      key={cmd.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: globalIndex * 0.02 }}
                      onClick={cmd.action}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150",
                        selectedIndex === globalIndex
                          ? "bg-[#D4AF37]/10 border border-[#D4AF37]/30"
                          : "hover:bg-[#F8F4E8]"
                      )}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        selectedIndex === globalIndex
                          ? "bg-[#D4AF37] text-white"
                          : "bg-[#F8F4E8] text-[#D4AF37]"
                      )}>
                        <cmd.icon className="w-4 h-4" />
                      </div>
                      
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-black">{cmd.title}</p>
                        {cmd.description && (
                          <p className="text-xs text-gray-500">{cmd.description}</p>
                        )}
                      </div>
                      
                      {cmd.shortcut && (
                        <div className="flex items-center gap-1">
                          {cmd.shortcut.map((key, i) => (
                            <kbd
                              key={i}
                              className="px-1.5 py-0.5 text-xs font-medium text-gray-500 bg-[#F8F4E8] rounded border border-[#E8E4D9]"
                            >
                              {key}
                            </kbd>
                          ))}
                        </div>
                      )}
                      
                      {selectedIndex === globalIndex && (
                        <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
                      )}
                    </motion.button>
                  )
                })}
              </div>
            ))}
            
            {filteredCommands.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <Search className="w-8 h-8 mb-2" />
                <p className="text-sm">No commands found for "{search}"</p>
              </div>
            )}
          </div>
        </ScrollArea>
        
        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#F8F4E8] border-t border-[#E8E4D9] text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-white rounded border border-[#E8E4D9]">↑↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-white rounded border border-[#E8E4D9]">↵</kbd>
              to select
            </span>
          </div>
          <span className="flex items-center gap-1 text-[#D4AF37]">
            <Sparkles className="w-3 h-3" />
            AI-powered search
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Global keyboard hook for opening command palette
export function useCommandPalette(onOpen: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to open
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        onOpen()
      }
    }
    
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onOpen])
}
