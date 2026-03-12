import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ============================================
// APP STATE TYPES
// ============================================

export interface User {
  id: string
  email: string
  name: string | null
  avatar: string | null
  role: string
  organizationId: string
  organization?: {
    id: string
    name: string
    slug: string
    plan: string
  }
}

export interface Lead {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  company: string | null
  title: string | null
  source: string | null
  status: string
  aiScore: number
  aiConfidence: number | null
  aiInsights: Record<string, unknown> | null
  aiNextAction: string | null
  estimatedValue: number | null
  lastContactedAt: string | null
  createdAt: string
  tags: { id: string; name: string; color: string }[]
}

export interface PipelineItem {
  id: string
  title: string
  value: number | null
  probability: number | null
  stageId: string
  leadId: string | null
  lead: Lead | null
  aiWinProbability: number | null
  expectedClose: string | null
}

export interface PipelineStage {
  id: string
  name: string
  color: string
  order: number
  items: PipelineItem[]
}

export interface Pipeline {
  id: string
  name: string
  stages: PipelineStage[]
}

export interface AIInsight {
  id: string
  type: 'trend' | 'prediction' | 'recommendation' | 'alert'
  category: string | null
  title: string
  description: string
  data: Record<string, unknown> | null
  confidence: number | null
  actionable: boolean
  dismissed: boolean
}

export interface Activity {
  id: string
  type: string
  title: string
  description: string | null
  metadata: Record<string, unknown> | null
  aiSummary: string | null
  createdAt: string
  lead?: Lead
  user?: { name: string | null; email: string }
}

export interface Automation {
  id: string
  name: string
  description: string | null
  trigger: string
  conditions: Record<string, unknown> | null
  actions: Record<string, unknown>[]
  isActive: boolean
  executionCount: number
}

export interface ContentItem {
  id: string
  type: string
  platform: string
  title: string | null
  content: string
  hashtags: string[] | null
  aiGenerated: boolean
  status: string
  scheduledFor: string | null
}

export interface Integration {
  id: string
  type: string
  name: string
  isActive: boolean
  lastSyncedAt: string | null
  syncStatus: string | null
}

// ============================================
// APP STORE
// ============================================

interface AppState {
  // User & Organization
  user: User | null
  setUser: (user: User | null) => void
  
  // UI State
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  activeTab: string
  setActiveTab: (tab: string) => void
  theme: 'dark' | 'light'
  setTheme: (theme: 'dark' | 'light') => void
  
  // Dashboard Stats
  stats: {
    totalLeads: number
    newLeadsToday: number
    pipelineValue: number
    wonThisMonth: number
    avgLeadScore: number
    activitiesToday: number
  } | null
  setStats: (stats: AppState['stats']) => void
  
  // Leads
  leads: Lead[]
  setLeads: (leads: Lead[]) => void
  addLead: (lead: Lead) => void
  updateLead: (id: string, data: Partial<Lead>) => void
  removeLead: (id: string) => void
  
  // Pipeline
  pipeline: Pipeline | null
  setPipeline: (pipeline: Pipeline | null) => void
  moveItem: (itemId: string, toStageId: string) => void
  
  // AI Insights
  insights: AIInsight[]
  setInsights: (insights: AIInsight[]) => void
  dismissInsight: (id: string) => void
  
  // Activities
  activities: Activity[]
  setActivities: (activities: Activity[]) => void
  addActivity: (activity: Activity) => void
  
  // Automations
  automations: Automation[]
  setAutomations: (automations: Automation[]) => void
  
  // Content Queue
  contentQueue: ContentItem[]
  setContentQueue: (content: ContentItem[]) => void
  
  // Integrations
  integrations: Integration[]
  setIntegrations: (integrations: Integration[]) => void
  
  // Loading States
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  
  // Notifications
  notifications: Array<{
    id: string
    type: 'success' | 'error' | 'warning' | 'info'
    title: string
    message?: string
  }>
  addNotification: (notification: Omit<AppState['notifications'][0], 'id'>) => void
  removeNotification: (id: string) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // User & Organization
      user: null,
      setUser: (user) => set({ user }),
      
      // UI State
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      activeTab: 'dashboard',
      setActiveTab: (tab) => set({ activeTab: tab }),
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      
      // Dashboard Stats
      stats: null,
      setStats: (stats) => set({ stats }),
      
      // Leads
      leads: [],
      setLeads: (leads) => set({ leads }),
      addLead: (lead) => set((state) => ({ leads: [...state.leads, lead] })),
      updateLead: (id, data) => set((state) => ({
        leads: state.leads.map((l) => (l.id === id ? { ...l, ...data } : l)),
      })),
      removeLead: (id) => set((state) => ({
        leads: state.leads.filter((l) => l.id !== id),
      })),
      
      // Pipeline
      pipeline: null,
      setPipeline: (pipeline) => set({ pipeline }),
      moveItem: (itemId, toStageId) => set((state) => {
        if (!state.pipeline) return state
        
        const stages = state.pipeline.stages.map((stage) => ({
          ...stage,
          items: stage.items.filter((item) => item.id !== itemId),
        }))
        
        const item = state.pipeline.stages
          .flatMap((s) => s.items)
          .find((i) => i.id === itemId)
        
        if (item) {
          const targetStageIndex = stages.findIndex((s) => s.id === toStageId)
          if (targetStageIndex !== -1) {
            stages[targetStageIndex].items.push({ ...item, stageId: toStageId })
          }
        }
        
        return { pipeline: { ...state.pipeline, stages } }
      }),
      
      // AI Insights
      insights: [],
      setInsights: (insights) => set({ insights }),
      dismissInsight: (id) => set((state) => ({
        insights: state.insights.map((i) =>
          i.id === id ? { ...i, dismissed: true } : i
        ),
      })),
      
      // Activities
      activities: [],
      setActivities: (activities) => set({ activities }),
      addActivity: (activity) => set((state) => ({
        activities: [activity, ...state.activities].slice(0, 100),
      })),
      
      // Automations
      automations: [],
      setAutomations: (automations) => set({ automations }),
      
      // Content Queue
      contentQueue: [],
      setContentQueue: (content) => set({ contentQueue: content }),
      
      // Integrations
      integrations: [],
      setIntegrations: (integrations) => set({ integrations }),
      
      // Loading States
      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }),
      
      // Notifications
      notifications: [],
      addNotification: (notification) => {
        const id = Math.random().toString(36).substring(7)
        set((state) => ({
          notifications: [...state.notifications, { ...notification, id }],
        }))
        // Auto remove after 5 seconds
        setTimeout(() => {
          get().removeNotification(id)
        }, 5000)
      },
      removeNotification: (id) => set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      })),
    }),
    {
      name: 'elite-crm-storage',
      partialize: (state) => ({
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
)
