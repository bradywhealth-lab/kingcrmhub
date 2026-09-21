import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  filterTasks,
  filterAppointments,
  isOverdue,
  FILTER_TABS,
  TaskCard,
  TasksView,
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
  completedAt?: string | null
  assignedTo?: { id: string; name: string; email: string } | null
  lead?: { id: string; firstName: string; lastName: string; company: string } | null
  pipelineItem?: { id: string; title: string } | null
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

type FilterTab = 'today' | 'week' | 'overdue' | 'completed'

function makeTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 't1',
    title: 'Test task',
    status: 'todo',
    priority: 'normal',
    dueDate: new Date().toISOString(),
    completedAt: null,
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

  it('returns only done tasks in Completed filter', () => {
    const tasks = [
      makeTask({ id: 'done1', status: 'done', completedAt: '2026-09-19T10:00:00.000Z' }),
      makeTask({ id: 'active', status: 'todo' }),
      makeTask({ id: 'blocked', status: 'blocked' }),
      makeTask({ id: 'progress', status: 'in_progress' }),
    ]
    const result = filterTasks(tasks, 'completed')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('done1')
  })

  it('sorts completed tasks newest-first by completedAt, null completedAt last', () => {
    const older = '2026-09-01T10:00:00.000Z'
    const newer = '2026-09-10T10:00:00.000Z'
    const tasks = [
      makeTask({ id: 'c', status: 'done', completedAt: older }),
      makeTask({ id: 'a', status: 'done', completedAt: newer }),
      makeTask({ id: 'b', status: 'done', completedAt: null }),
    ]
    const result = filterTasks(tasks, 'completed')
    expect(result.map((t) => t.id)).toEqual(['a', 'c', 'b'])
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

  it('returns only completed appointments in Completed filter', () => {
    const appts = [
      makeAppointment({ id: 'a1', status: 'completed' }),
      makeAppointment({ id: 'a2', status: 'scheduled' }),
      makeAppointment({ id: 'a3', status: 'cancelled' }),
    ]
    const result = filterAppointments(appts, 'completed')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('a1')
  })

  it('excludes completed appointments from Today/Week filters (no double-count)', () => {
    const appts = [makeAppointment({ status: 'completed' })]
    expect(filterAppointments(appts, 'today')).toHaveLength(0)
    expect(filterAppointments(appts, 'week')).toHaveLength(0)
  })
})

describe('Completed tab UI (render coverage)', () => {
  it('includes a Completed tab in the filter tab bar', () => {
    const labels = FILTER_TABS.map((t) => t.label)
    expect(labels).toContain('Completed')
  })

  it('TaskCard renders completedAt date, priority dot, and pipeline reference for done tasks', () => {
    const html = renderToStaticMarkup(
      <TaskCard
        task={{
          id: 'done1',
          title: 'Ship onboarding',
          status: 'done',
          priority: 'urgent',
          completedAt: '2026-09-19T10:00:00.000Z',
          createdAt: '2026-09-01T10:00:00.000Z',
          position: 0,
          lead: { id: 'lead1', firstName: 'Ada', lastName: 'Lovelace', company: 'Analytical' },
          pipelineItem: { id: 'pipe1', title: 'Onboarding flow' },
          assignedTo: { id: 'u1', name: 'Sam', email: 'sam@example.com' },
        }}
        onToggleDone={() => {}}
      />
    )
    expect(html).toContain('Ship onboarding')
    expect(html).toContain('Completed')
    // priority dot present for urgent
    expect(html).toContain('bg-red-500')
    // lead + pipeline link + assignee rendered
    expect(html).toContain('Ada Lovelace')
    expect(html).toContain('Onboarding flow')
    expect(html).toContain('Sam')
  })

  it('renders completed tasks in list view when Completed tab selected', () => {
    const html = renderToStaticMarkup(
      <TasksView
        initialTab="completed"
        initialTasks={[
          {
            id: 'done1',
            title: 'Archived task',
            status: 'done',
            priority: 'normal',
            completedAt: '2026-09-19T10:00:00.000Z',
            createdAt: '2026-09-01T10:00:00.000Z',
            position: 0,
          },
        ]}
        initialAppointments={[]}
      />
    )
    expect(html).toContain('Archived task')
    expect(html).toContain('Completed')
    // active tabs remain available
    expect(html).toContain('Today')
    expect(html).toContain('This Week')
    expect(html).toContain('Overdue')
  })

  it('empty state message for the Completed tab', () => {
    const html = renderToStaticMarkup(
      <TasksView initialTab="completed" initialTasks={[]} initialAppointments={[]} />
    )
    expect(html).toContain('No completed tasks yet')
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