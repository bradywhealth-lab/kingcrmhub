import { describe, expect, it } from 'vitest'
import {
  filterTasks,
  filterAppointments,
  isOverdue,
} from '@/components/tasks/tasks-view'

/**
 * TasksView filter/grouping logic tests — gate A: regression insurance for PR #173.
 *
 * Tests import the ACTUAL exported pure functions from tasks-view.tsx
 * (cubic P2 fix: no duplicated logic — these guard the real implementation).
 */

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

describe('filterTasks (imported from tasks-view.tsx)', () => {
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

describe('filterAppointments (imported from tasks-view.tsx)', () => {
  it('returns empty array for Overdue tab (appointments cannot be overdue)', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const appts = [makeAppointment({ startTime: yesterday.toISOString() })]
    expect(filterAppointments(appts, 'overdue')).toHaveLength(0)
  })

  it('excludes cancelled appointments from all tabs', () => {
    const appts = [makeAppointment({ status: 'cancelled' })]
    expect(filterAppointments(appts, 'today')).toHaveLength(0)
    expect(filterAppointments(appts, 'week')).toHaveLength(0)
  })

  it('includes scheduled appointment due today in Today filter', () => {
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

describe('isOverdue (imported from tasks-view.tsx)', () => {
  it('returns true for yesterday', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(isOverdue(yesterday)).toBe(true)
  })

  it('returns false for today', () => {
    expect(isOverdue(new Date())).toBe(false)
  })

  it('returns false for tomorrow', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    expect(isOverdue(tomorrow)).toBe(false)
  })
})

describe('empty + kanban invariants', () => {
  it('empty state: no tasks + no appointments = empty', () => {
    const tasks = filterTasks([], 'today')
    const appts = filterAppointments([], 'today')
    expect(tasks.length + appts.length).toBe(0)
  })

  it('kanban: tasks distribute to status columns (status filter works)', () => {
    const tasks: TaskRecord[] = [
      makeTask({ id: 't1', status: 'todo' }),
      makeTask({ id: 't2', status: 'in_progress' }),
      makeTask({ id: 't3', status: 'done' }),
      makeTask({ id: 't4', status: 'blocked' }),
    ]
    const filtered = filterTasks(tasks, 'today')
    // done tasks are excluded from filter
    const statuses = filtered.map((t) => t.status)
    expect(statuses).not.toContain('done')
    expect(filtered.length).toBe(3)
  })
})