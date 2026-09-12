'use client'

import { useEffect, useState, useMemo } from 'react'
import { CheckSquare, Calendar, List, Columns, Plus, Clock, AlertTriangle, Check, User, Building } from 'lucide-react'

/**
 * Tasks & Appointments Hub — unified day view (frozen spec: PR B).
 *
 * DATA FLOW (gate B — booking.ts integration):
 *   Booking page (/book/[slug]) → POST /api/bookings → Appointment record in DB
 *   → TasksView fetches from GET /api/appointments (this file)
 *   → Appointments created through the booking page render here automatically.
 *
 *   Server-side tier gates (PR #172, already deployed):
 *   - Tasks: FREE tier (GET /api/tasks)
 *   - Auto-spawn: Starter+ only (hasFeatureAccess check in auto-spawn/route.ts:35)
 *   - Google Calendar sync: Pro+ (Phase 3, per roadmap)
 */
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import { buildApiPath } from '@/lib/api-client'

/** Tasks & Appointments Hub — unified day view (frozen spec: PR B). */

type TaskRecord = {
  id: string
  title: string
  description?: string | null
  status: 'todo' | 'in_progress' | 'done' | 'blocked'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  dueDate?: string | null
  completedAt?: string | null
  assignedTo?: { id: string; name: string; email: string } | null
  lead?: { id: string; firstName: string; lastName: string; company: string } | null
  pipelineItem?: { id: string; title: string } | null
  source?: string | null
  position: number
  createdAt: string
}

type AppointmentRecord = {
  id: string
  title: string
  description?: string | null
  startTime: string
  endTime: string
  timezone: string
  location?: string | null
  status: 'scheduled' | 'cancelled' | 'completed'
  lead?: { id: string; firstName: string; lastName: string; company: string } | null
  attendeeName?: string | null
  attendeeEmail?: string | null
}

type FilterTab = 'today' | 'week' | 'overdue'
type ViewMode = 'list' | 'kanban'

const FILTER_TABS: { id: FilterTab; label: string; icon: typeof Clock }[] = [
  { id: 'today', label: 'Today', icon: Clock },
  { id: 'week', label: 'This Week', icon: Calendar },
  { id: 'overdue', label: 'Overdue', icon: AlertTriangle },
]

const STATUS_COLUMNS = [
  { key: 'todo' as const, label: 'To Do', color: 'bg-[#0c111b]/8 text-[#0c111b]' },
  { key: 'in_progress' as const, label: 'In Progress', color: 'bg-[#127c66]/12 text-[#127c66]' },
  { key: 'done' as const, label: 'Done', color: 'bg-[#18b897]/12 text-[#127c66]' },
  { key: 'blocked' as const, label: 'Blocked', color: 'bg-amber-100 text-amber-700' },
]

const PRIORITY_DOT: Record<string, string> = {
  low: 'bg-slate-300',
  normal: 'bg-[#127c66]',
  high: 'bg-amber-500',
  urgent: 'bg-red-500',
}

function formatAppointmentTime(startTime: string, endTime: string, timezone: string): string {
  let tz = timezone || 'America/New_York'
  try {
    const start = new Date(startTime)
    const end = new Date(endTime)
    return `${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz })} – ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz })}`
  } catch {
    // Invalid timezone → fall back to UTC
    const start = new Date(startTime)
    const end = new Date(endTime)
    return `${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })} – ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })} UTC`
  }
}

function isToday(d: Date): boolean {
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

export function isThisWeek(d: Date): boolean {
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)
  return d >= weekStart && d < weekEnd
}

export function isOverdue(d: Date): boolean {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return d < now
}

export function filterTasks(tasks: TaskRecord[], tab: FilterTab): TaskRecord[] {
  return tasks.filter((t) => {
    if (t.status === 'done') return false
    if (!t.dueDate) return tab === 'week' // undated tasks show in week view
    const d = new Date(t.dueDate)
    switch (tab) {
      case 'today': return isToday(d)
      case 'week': return isThisWeek(d)
      case 'overdue': return isOverdue(d)
    }
  })
}

export function filterAppointments(appts: AppointmentRecord[], tab: FilterTab): AppointmentRecord[] {
  if (tab === 'overdue') return [] // appointments can't be overdue
  return appts.filter((a) => {
    if (a.status === 'cancelled') return false
    const d = new Date(a.startTime)
    switch (tab) {
      case 'today': return isToday(d)
      case 'week': return isThisWeek(d)
      default: return false
    }
  })
}

function LeadBadge({ lead }: { lead?: { firstName: string; lastName: string; company: string } | null }) {
  if (!lead) return null
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-[#0c111b]/50">
      <Building className="h-3 w-3" />
      {lead.firstName} {lead.lastName}
      {lead.company ? ` · ${lead.company}` : ''}
    </span>
  )
}

function TaskCard({ task, onToggleDone }: { task: TaskRecord; onToggleDone: (id: string) => void }) {
  const isDone = task.status === 'done'
  return (
    <Card
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', task.id); e.dataTransfer.effectAllowed = 'move' }}
      className={`group border-[rgba(31,42,54,0.08)] bg-white shadow-[0_4px_16px_rgba(31,42,54,0.04)] hover:shadow-[0_8px_24px_rgba(31,42,54,0.08)] transition-shadow ${isDone ? 'opacity-60' : ''}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <button
            onClick={() => onToggleDone(task.id)}
            aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
              isDone
                ? 'border-[#18b897] bg-[#18b897] text-white'
                : 'border-[#0c111b]/20 hover:border-[#18b897]/50'
            }`}
          >
            {isDone && <Check className="h-3 w-3" />}
          </button>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium leading-snug ${isDone ? 'text-[#0c111b]/40 line-through' : 'text-[#0c111b]'}`}>{task.title}</p>
            {task.description && (
              <p className="mt-1 text-xs text-[#0c111b]/55 line-clamp-2">{task.description}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <LeadBadge lead={task.lead} />
              {task.assignedTo && (
                <span className="inline-flex items-center gap-1 text-[11px] text-[#0c111b]/50">
                  <User className="h-3 w-3" />
                  {task.assignedTo.name ?? task.assignedTo.email}
                </span>
              )}
              {task.source === 'auto_spawn' && (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-[#18b897]/30 text-[#127c66]">
                  auto
                </Badge>
              )}
            </div>
          </div>
          {task.dueDate && (
            <span className="shrink-0 text-[11px] tabular-nums text-[#0c111b]/45">
              {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function AppointmentCard({ appt }: { appt: AppointmentRecord }) {
  const timeStr = formatAppointmentTime(appt.startTime, appt.endTime, appt.timezone || 'America/New_York')

  return (
    <Card className="border-[rgba(31,42,54,0.06)] bg-[#f6f9ff] shadow-none">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#127c66]/10">
            <Calendar className="h-4 w-4 text-[#127c66]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#0c111b]">{appt.title}</p>
            <p className="mt-0.5 text-xs text-[#0c111b]/55">{timeStr}</p>
            {appt.location && (
              <p className="mt-0.5 text-[11px] text-[#0c111b]/40">{appt.location}</p>
            )}
            <div className="mt-1.5">
              <LeadBadge lead={appt.lead} />
            </div>
          </div>
          {appt.status === 'completed' && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-[#18b897]/30 text-[#127c66]">done</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyState({ tab }: { tab: FilterTab }) {
  const messages: Record<FilterTab, { title: string; body: string }> = {
    today: { title: 'Nothing due today', body: 'Tasks due today or appointments scheduled will appear here.' },
    week: { title: 'Clear week ahead', body: 'Tasks and appointments for this week will show up here.' },
    overdue: { title: 'All caught up', body: 'No overdue tasks — nice work.' },
  }
  const m = messages[tab]
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <CheckSquare className="h-12 w-12 text-[#0c111b]/12" />
      <p className="mt-4 text-sm font-medium text-[#0c111b]/60">{m.title}</p>
      <p className="mt-1 text-xs text-[#0c111b]/40 max-w-xs">{m.body}</p>
    </div>
  )
}

export function TasksView() {
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<FilterTab>('today')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [showCreate, setShowCreate] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [createPriority, setCreatePriority] = useState<string>('normal')
  const [createDue, setCreateDue] = useState('')
  const [createSaving, setCreateSaving] = useState(false)
  const [pendingToggles, setPendingToggles] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const [tRes, aRes] = await Promise.all([
          fetch(buildApiPath('/api/tasks'), { cache: 'no-store' }),
          fetch(buildApiPath('/api/appointments'), { cache: 'no-store' }),
        ])

        if (!cancelled) {
          if (tRes.status === 401 || aRes.status === 401) { window.location.href = buildApiPath('/auth'); return }
          if (tRes.ok) {
            const tData = await tRes.json() as { tasks?: TaskRecord[] }
            setTasks(Array.isArray(tData.tasks) ? tData.tasks : [])
          }
          if (aRes.ok) {
            const aData = await aRes.json() as { appointments?: AppointmentRecord[] }
            setAppointments(Array.isArray(aData.appointments) ? aData.appointments : [])
          }
        }
      } catch {
        if (!cancelled) {
          toast({ title: 'Could not load tasks', description: 'Please refresh to try again.', variant: 'destructive' })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [])

  const filteredTasks = useMemo(() => filterTasks(tasks, tab), [tasks, tab])
  const filteredAppointments = useMemo(() => filterAppointments(appointments, tab), [appointments, tab])

  const kanbanColumns = useMemo(() => {
    if (viewMode !== 'kanban') return []
    // Kanban shows ALL tasks (including done) so the Done column isn't empty
    const boardTasks = filterTasks(tasks, tab)
    // Also include any done tasks matching the tab's date range
    const doneTasks = tasks.filter((t) => {
      if (t.status !== 'done') return false
      if (!t.dueDate) return tab === 'week'
      const d = new Date(t.dueDate)
      switch (tab) {
        case 'today': return isToday(d)
        case 'week': return isThisWeek(d)
        case 'overdue': return false // done tasks can't be overdue
      }
    })
    const allBoardTasks = [...boardTasks, ...doneTasks]
    return STATUS_COLUMNS.map((col) => ({
      ...col,
      tasks: allBoardTasks.filter((t) => t.status === col.key),
    }))
  }, [viewMode, tasks, tab])

  const isEmpty = filteredTasks.length === 0 && filteredAppointments.length === 0
  // In Kanban mode, also check if board has any tasks (including done)
  const kanbanIsEmpty = viewMode === 'kanban' && kanbanColumns.every((col) => col.tasks.length === 0) && filteredAppointments.length === 0

  const handleToggleDone = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    // Serialize per-task: skip while a PATCH for this task is still in flight
    if (pendingToggles.has(taskId)) return
    setPendingToggles((prev) => new Set(prev).add(taskId))
    const newStatus = task.status === 'done' ? 'todo' : 'done'
    // Optimistic update
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t))
    try {
      const res = await fetch(buildApiPath(`/api/tasks/${taskId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Failed')
    } catch {
      // Revert on failure
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: task.status } : t))
      toast({ title: 'Could not update task', variant: 'destructive' })
    } finally {
      setPendingToggles((prev) => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
    }
  }

  const handleCreateTask = async () => {
    if (!createTitle.trim() || createSaving) return
    setCreateSaving(true)
    try {
      const res = await fetch(buildApiPath('/api/tasks'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createTitle.trim(),
          priority: createPriority,
          dueDate: createDue ? new Date(createDue + 'T00:00:00').toISOString() : undefined,
        }),
      })
      if (res.status === 401) { window.location.href = buildApiPath('/auth'); return }
      if (!res.ok) throw new Error('Failed to create task')
      const { task } = await res.json()
      setTasks((prev) => [...prev, task])
      setShowCreate(false)
      setCreateTitle('')
      setCreatePriority('normal')
      setCreateDue('')
      toast({ title: 'Task created', description: task.title })
    } catch {
      toast({ title: 'Could not create task', description: 'Please try again.', variant: 'destructive' })
    } finally {
      setCreateSaving(false)
    }
  }

  const handleMoveTask = async (taskId: string, newStatus: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.status === newStatus) return
    if (pendingToggles.has(taskId)) return
    setPendingToggles((prev) => new Set(prev).add(taskId))
    const oldStatus = task.status
    const newStatusTyped = newStatus as TaskRecord['status']
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatusTyped } : t))
    try {
      const res = await fetch(buildApiPath(`/api/tasks/${taskId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Failed')
    } catch {
      const oldStatusTyped = oldStatus as TaskRecord['status']
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: oldStatusTyped } : t))
      toast({ title: 'Could not move task', variant: 'destructive' })
    } finally {
      setPendingToggles((prev) => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
    }
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="h-8 w-48 bg-[#0c111b]/6 animate-pulse rounded-lg" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-[#0c111b]/4 animate-pulse rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header with filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-2xl border border-[rgba(31,42,54,0.08)] bg-white p-1 shadow-sm">
          {FILTER_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                tab === id
                  ? 'bg-[#18b897]/14 text-[#127c66]'
                  : 'text-[#0c111b]/55 hover:text-[#0c111b]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-[rgba(31,42,54,0.08)] bg-white p-0.5">
            <button
              onClick={() => setViewMode('list')}
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
              className={`rounded-lg px-3 py-1.5 ${viewMode === 'list' ? 'bg-[#0c111b]/6 text-[#0c111b]' : 'text-[#0c111b]/40 hover:text-[#0c111b]'}`}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              aria-label="Kanban board view"
              aria-pressed={viewMode === 'kanban'}
              className={`rounded-lg px-3 py-1.5 ${viewMode === 'kanban' ? 'bg-[#0c111b]/6 text-[#0c111b]' : 'text-[#0c111b]/40 hover:text-[#0c111b]'}`}
            >
              <Columns className="h-4 w-4" />
            </button>
          </div>

          <Button
            onClick={() => setShowCreate(true)}
            size="sm"
            className="rounded-xl bg-[#18b897] text-white hover:bg-[#15a88a] h-9 px-4 gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Create Task
          </Button>
        </div>
      </div>

      {viewMode === 'kanban' ? (
        kanbanIsEmpty ? (
          <EmptyState tab={tab} />
        ) : (
        /* Kanban board + appointments */
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {kanbanColumns.map((col) => (
              <div
              key={col.key}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
              onDrop={(e) => { e.preventDefault(); const taskId = e.dataTransfer.getData('text/plain'); if (taskId) handleMoveTask(taskId, col.key) }}
              className="rounded-2xl border border-[rgba(31,42,54,0.06)] bg-[#fcf8ec]/60 p-4 min-h-[120px]">
                <div className="mb-3 flex items-center justify-between">
                  <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${col.color}`}>
                    {col.label}
                  </span>
                  <span className="text-xs text-[#0c111b]/35 tabular-nums">{col.tasks.length}</span>
                </div>
                <div className="space-y-3">
                  {col.tasks.length === 0 ? (
                    <p className="py-6 text-center text-xs text-[#0c111b]/25">No tasks</p>
                  ) : (
                    col.tasks.map((task) => <TaskCard key={task.id} task={task} onToggleDone={handleToggleDone} />)
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredAppointments.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-[#0c111b]/40">Appointments</h2>
              <div className="space-y-3">
                {filteredAppointments.map((appt) => (
                  <AppointmentCard key={appt.id} appt={appt} />
                ))}
              </div>
            </section>
          )}
        </div>
      )) : isEmpty ? (
        <EmptyState tab={tab} />
      ) : (
        /* List view — tasks first, then appointments */
        <div className="space-y-8">
          {filteredTasks.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-[#0c111b]/40">Tasks</h2>
              <div className="space-y-3">
                {filteredTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onToggleDone={handleToggleDone} />
                ))}
              </div>
            </section>
          )}

          {filteredAppointments.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-[#0c111b]/40">Appointments</h2>
              <div className="space-y-3">
                {filteredAppointments.map((appt) => (
                  <AppointmentCard key={appt.id} appt={appt} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Create Task Dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c111b]/40 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-task-title"
            onKeyDown={(e) => { if (e.key === 'Escape') setShowCreate(false) }}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[rgba(31,42,54,0.08)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="create-task-title" className="text-lg font-semibold text-[#0c111b]">Create Task</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="task-title" className="block text-xs font-medium text-[#0c111b]/60 mb-1.5">Title</label>
                <Input
                  id="task-title"
                  autoFocus
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="What needs to be done?"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTask() }}
                />
              </div>
              <div>
                <label htmlFor="task-priority" className="block text-xs font-medium text-[#0c111b]/60 mb-1.5">Priority</label>
                <select
                  id="task-priority"
                  value={createPriority}
                  onChange={(e) => setCreatePriority(e.target.value)}
                  className="w-full h-10 rounded-xl border border-[rgba(31,42,54,0.08)] bg-white px-3 text-sm text-[#0c111b] focus:outline-none focus:ring-2 focus:ring-[#18b897]/30"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label htmlFor="task-due" className="block text-xs font-medium text-[#0c111b]/60 mb-1.5">Due date</label>
                <Input
                  id="task-due"
                  type="date"
                  value={createDue}
                  onChange={(e) => setCreateDue(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowCreate(false)} disabled={createSaving}>Cancel</Button>
              <Button
                onClick={handleCreateTask}
                disabled={!createTitle.trim() || createSaving}
                className="rounded-xl bg-[#18b897] text-white hover:bg-[#15a88a]"
              >
                {createSaving ? 'Creating...' : 'Create Task'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}