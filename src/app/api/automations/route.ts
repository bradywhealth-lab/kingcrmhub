import { NextResponse } from "next/server"

type Automation = {
  id: string
  name: string
  trigger: string
  actions: string
  createdAt: string
}

const automationsStore: Automation[] = []

export async function GET() {
  return NextResponse.json({ automations: automationsStore })
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<Automation>
    const name = body.name?.trim()
    const trigger = body.trigger?.trim()
    const actions = body.actions?.trim()

    if (!name || !trigger || !actions) {
      return NextResponse.json(
        { error: "name, trigger, and actions are required." },
        { status: 400 },
      )
    }

    const automation: Automation = {
      id: crypto.randomUUID(),
      name,
      trigger,
      actions,
      createdAt: new Date().toISOString(),
    }
    automationsStore.unshift(automation)

    return NextResponse.json({ automation }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 })
  }
}
