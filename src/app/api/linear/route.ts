import { NextRequest, NextResponse } from "next/server"
import {
  isLinearConfigured,
  fetchLinearIssues,
  fetchLinearTeams,
  createLinearIssue,
  updateLinearIssue,
  fetchLinearWorkflowStates,
} from "@/lib/linear"

export async function GET(req: NextRequest) {
  if (!isLinearConfigured()) {
    return NextResponse.json(
      { error: "Linear is not configured", configured: false },
      { status: 200 }
    )
  }

  const { searchParams } = new URL(req.url)
  const action = searchParams.get("action") ?? "issues"

  try {
    switch (action) {
      case "status": {
        const teams = await fetchLinearTeams()
        return NextResponse.json({ configured: true, teams })
      }

      case "teams": {
        const teams = await fetchLinearTeams()
        return NextResponse.json({ teams })
      }

      case "issues": {
        const teamId = searchParams.get("teamId") ?? undefined
        const first = searchParams.get("first")
          ? parseInt(searchParams.get("first")!)
          : 50
        const after = searchParams.get("after") ?? undefined
        const data = await fetchLinearIssues({ teamId, first, after })
        return NextResponse.json(data)
      }

      case "states": {
        const teamId = searchParams.get("teamId")
        if (!teamId) {
          return NextResponse.json({ error: "teamId is required" }, { status: 400 })
        }
        const states = await fetchLinearWorkflowStates(teamId)
        return NextResponse.json({ states })
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[Linear API GET]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!isLinearConfigured()) {
    return NextResponse.json(
      { error: "Linear is not configured" },
      { status: 400 }
    )
  }

  try {
    const body = await req.json()
    const { action } = body

    switch (action) {
      case "create": {
        const { title, description, teamId, priority, labelIds } = body
        if (!title || !teamId) {
          return NextResponse.json(
            { error: "title and teamId are required" },
            { status: 400 }
          )
        }
        const issue = await createLinearIssue({
          title,
          description,
          teamId,
          priority,
          labelIds,
        })
        return NextResponse.json({ issue })
      }

      case "update": {
        const { issueId, ...updates } = body
        if (!issueId) {
          return NextResponse.json(
            { error: "issueId is required" },
            { status: 400 }
          )
        }
        const { action: _, ...cleanUpdates } = updates
        const success = await updateLinearIssue(issueId, cleanUpdates)
        return NextResponse.json({ success })
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[Linear API POST]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
