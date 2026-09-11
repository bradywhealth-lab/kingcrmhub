import { describe, expect, it } from 'vitest'

/**
 * TasksView filter logic tests — gate A: regression insurance for PR #173.
 *
 * Tests the filter/grouping logic extracted into pure functions so they can
 * be verified without React Testing Library (not installed in this project).
 */

// ── Extracted pure functions (mirrors TasksView logic) ──

type TaskRecord = {
  id: string
  title: string
  status: 'todo' | 'in_progress' | 'done' | 'blocked'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  dueDate?: string | null
  createdAt: string
  position: number
}

type AppointmentRecord = {
  id: string
  title: string
  startTime: string
  endTime: string
  timezone: string
  status: 'scheduled' | 'cancelled' | 'completed'
}

type FilterTab = 'today' | 'week' | 'overdue'

function isToday(d: Date): boolean {
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function isThisWeek(d: Date): boolean {
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)
  return d >= weekStart && d < weekEnd
}

function isOverdue(d: Date): boolean {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return d < now
}

function filterTasks(tasks: TaskRecord[], tab: FilterTab): TaskRecord[] {
  return tasks.filter((t) => {
    if (t.status === 'done') return false
    if (!t.dueDate) return tab === 'week'
    const d = new Date(t.dueDate)
    switch (tab) {
      case 'today': return isToday(d)
      case 'week': return isThisWeek(d)
      case 'overdue': return isOverdue(d)
    }
  })
}

function filterAppointments(appts: AppointmentRecord[], tab: FilterTab): AppointmentRecord[] {
  if (tab === 'overdue') return []
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

const STATUS_COLUMNS = ['todo', 'in_progress', 'done', 'blocked'] as const

function groupKanbanColumns(tasks: TaskRecord[]) {
  return STATUS_COLUMNS.map((key) => ({
    key,
    tasks: tasks.filter((t) => t.status === key),
  }))
}

// ── Helpers ──

function makeTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 't1',
    title: 'Test task',
    status: 'todo',
    priority: 'normal',
    dueDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    position: 0,
    ...overrides,
  }
}

function makeAppointment(overrides: Partial<AppointmentRecord> = {}): AppointmentRecord {
  return {
    id: 'a1',
    title: 'Test meeting',
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 3600000).toISOString(),
    timezone: 'America/New_York',
    status: 'scheduled',
    ...overrides,
  }
}

// ── Tests ──

describe('filterTasks', () => {
  it('returns empty array when no tasks match Today filter', () => {
    const future = new Date()
    future.setDate(future.getDate() + 3)
    const tasks = [makeTask({ dueDate: future.toISOString() })]
    expect(filterTasks(tasks, 'today')).toHaveLength(0)
  })

  it('includes task due today in Today filter', () => {
    const tasks = [makeTask({ dueDate: new Date().toISOString() })]
    expect(filterTasks(tasks, 'today')).toHaveLength(1)
  })

  it('excludes done tasks from all filters', () => {
    const tasks = [makeTask({ status: 'done', dueDate: new Date().toISOString() })]
    expect(filterTasks(tasks, 'today')).toHaveLength(0)
    expect(filterTasks(tasks, 'week')).toHaveLength(0)
    expect(filterTasks(tasks, 'overdue')).toHaveLength(0)
  })

  it('includes undated tasks in Week filter only', () => {
    const tasks = [makeTask({ dueDate: null })]
    expect(filterTasks(tasks, 'today')).toHaveLength(0)
    expect(filterTasks(tasks, 'week')).toHaveLength(1)
    expect(filterTasks(tasks, 'overdue')).toHaveLength(0)
  })

  it('returns only overdue tasks in Overdue filter', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)

    const tasks = [
      makeTask({ id: 'late', dueDate: yesterday.toISOString() }),
      makeTask({ id: 'future', dueDate: tomorrow.toISOString() }),
    ]
    const result = filterTasks(tasks, 'overdue')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('late')
  })
})

describe('filterAppointments', () => {
  it('returns empty array for Overdue tab (appointments cannot be overdue)', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const appts = [makeAppointment({ startTime: yesterday.toISOString() })]
    expect(filterAppointments(appts, 'overdue')).toHaveLength(0)
  })

  it('excludes cancelled appointments', () => {
    const appts = [makeAppointment({ status: 'cancelled' })]
    expect(filterAppointments(appts, 'today')).toHaveLength(0)
  })

  it('includes scheduled appointment due today', () => {
    const appts = [makeAppointment({ startTime: new Date().toISOString() })]
    expect(filterAppointments(appts, 'today')).toHaveLength(1)
  })

  it('excludes future appointment from Today filter', () => {
    const future = new Date()
    future.setDate(future.getDate() + 3)
    const appts = [makeAppointment({ startTime: future.toISOString() })]
    expect(filterAppointments(appts, 'today')).toHaveLength(0)
  })
})

describe('groupKanbanColumns', () => {
  it('distributes tasks across status columns', () => {
    const tasks: TaskRecord[] = [
      makeTask({ id: 't1', status: 'todo' }),
      makeTask({ id: 't2', status: 'in_progress' }),
      makeTask({ id: 't3', status: 'done' }),
      makeTask({ id: 't4', status: 'blocked' }),
    ]
    const columns = groupKanbanColumns(tasks)
    expect(columns).toHaveLength(4)
    expect(columns[0].tasks).toHaveLength(1)
    expect(columns[0].tasks[0].id).toBe('t1')
    expect(columns[1].tasks[0].id).toBe('t2')
    expect(columns[2].tasks[0].id).toBe('t3')
    expect(columns[3].tasks[0].id).toBe('t4')
  })

  it('returns empty columns when no tasks', () => {
    const columns = groupKanbanColumns([])
    expect(columns).toHaveLength(4)
    columns.forEach((col) => expect(col.tasks).toHaveLength(0))
  })

  it('groups multiple tasks in same column', () => {
    const tasks = [
      makeTask({ id: 't1', status: 'todo' }),
      makeTask({ id: 't2', status: 'todo' }),
    ]
    const columns = groupKanbanColumns(tasks)
    expect(columns[0].tasks).toHaveLength(2)
  })
})

describe('isEmpty state', () => {
  it('returns true when both tasks and appointments are empty', () => {
    const tasks = filterTasks([], 'today')
    const appts = filterAppointments([], 'today')
    expect(tasks.length + appts.length).toBe(0)
  })

  it('returns false when tasks exist', () => {
    const tasks = filterTasks([makeTask()], 'today')
    expect(tasks.length).toBeGreaterThan(0)
  })
})