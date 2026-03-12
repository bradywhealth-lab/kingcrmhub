import { LinearClient } from "@linear/sdk"

let _client: LinearClient | null = null

export function getLinearClient(): LinearClient | null {
  const apiKey = process.env.LINEAR_API_KEY
  if (!apiKey) return null
  if (!_client) {
    _client = new LinearClient({ apiKey })
  }
  return _client
}

export function isLinearConfigured(): boolean {
  return !!process.env.LINEAR_API_KEY
}

export interface LinearIssueData {
  id: string
  identifier: string
  title: string
  description?: string | null
  url: string
  state: { name: string; color: string } | null
  priority: number
  priorityLabel: string
  assignee: { name: string; email: string; avatarUrl?: string | null } | null
  team: { name: string; key: string } | null
  labels: { name: string; color: string }[]
  createdAt: string
  updatedAt: string
  dueDate: string | null
}

export interface LinearTeamData {
  id: string
  name: string
  key: string
  description?: string | null
}

export async function fetchLinearIssues(opts?: {
  teamId?: string
  first?: number
  after?: string
}): Promise<{ issues: LinearIssueData[]; hasMore: boolean; endCursor?: string | null }> {
  const client = getLinearClient()
  if (!client) throw new Error("Linear is not configured")

  const filter: Record<string, unknown> = {}
  if (opts?.teamId) filter.team = { id: { eq: opts.teamId } }

  const result = await client.issues({
    first: opts?.first ?? 50,
    after: opts?.after,
    filter,
    orderBy: LinearClient.name ? undefined : undefined,
  })

  const issues: LinearIssueData[] = await Promise.all(
    result.nodes.map(async (issue) => {
      const state = await issue.state
      const assignee = await issue.assignee
      const team = await issue.team
      const labels = await issue.labels()

      return {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description,
        url: issue.url,
        state: state ? { name: state.name, color: state.color } : null,
        priority: issue.priority,
        priorityLabel: issue.priorityLabel,
        assignee: assignee
          ? { name: assignee.name, email: assignee.email, avatarUrl: assignee.avatarUrl }
          : null,
        team: team ? { name: team.name, key: team.key } : null,
        labels: labels.nodes.map((l) => ({ name: l.name, color: l.color })),
        createdAt: issue.createdAt.toISOString(),
        updatedAt: issue.updatedAt.toISOString(),
        dueDate: issue.dueDate ?? null,
      }
    })
  )

  return {
    issues,
    hasMore: result.pageInfo.hasNextPage,
    endCursor: result.pageInfo.endCursor,
  }
}

export async function fetchLinearTeams(): Promise<LinearTeamData[]> {
  const client = getLinearClient()
  if (!client) throw new Error("Linear is not configured")

  const result = await client.teams()
  return result.nodes.map((t) => ({
    id: t.id,
    name: t.name,
    key: t.key,
    description: t.description ?? undefined,
  }))
}

export async function createLinearIssue(input: {
  title: string
  description?: string
  teamId: string
  priority?: number
  labelIds?: string[]
}): Promise<LinearIssueData> {
  const client = getLinearClient()
  if (!client) throw new Error("Linear is not configured")

  const payload = await client.createIssue({
    title: input.title,
    description: input.description,
    teamId: input.teamId,
    priority: input.priority,
    labelIds: input.labelIds,
  })

  const issue = await payload.issue
  if (!issue) throw new Error("Failed to create issue")

  const state = await issue.state
  const assignee = await issue.assignee
  const team = await issue.team
  const labels = await issue.labels()

  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    description: issue.description,
    url: issue.url,
    state: state ? { name: state.name, color: state.color } : null,
    priority: issue.priority,
    priorityLabel: issue.priorityLabel,
    assignee: assignee
      ? { name: assignee.name, email: assignee.email, avatarUrl: assignee.avatarUrl }
      : null,
    team: team ? { name: team.name, key: team.key } : null,
    labels: labels.nodes.map((l) => ({ name: l.name, color: l.color })),
    createdAt: issue.createdAt.toISOString(),
    updatedAt: issue.updatedAt.toISOString(),
    dueDate: issue.dueDate ?? null,
  }
}

export async function updateLinearIssue(
  issueId: string,
  input: { title?: string; description?: string; priority?: number; stateId?: string }
): Promise<boolean> {
  const client = getLinearClient()
  if (!client) throw new Error("Linear is not configured")

  const payload = await client.updateIssue(issueId, input)
  return payload.success
}

export async function fetchLinearWorkflowStates(teamId: string) {
  const client = getLinearClient()
  if (!client) throw new Error("Linear is not configured")

  const team = await client.team(teamId)
  const states = await team.states()
  return states.nodes.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    type: s.type,
    position: s.position,
  }))
}
