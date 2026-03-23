import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { createSessionToken } from '@/lib/auth'
import { hashSessionToken } from '@/lib/auth'
import { z } from 'zod'

const inviteSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'agent', 'viewer']).default('agent'),
})

const patchSchema = z.object({
  role: z.enum(['owner', 'admin', 'agent', 'viewer']).optional(),
  isActive: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  try {
    return withRequestOrgContext(request, async (context) => {
      const members = await db.teamMember.findMany({
        where: { organizationId: context.organizationId },
        orderBy: { createdAt: 'asc' },
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      })

      return NextResponse.json({
        members: members.map((member) => ({
          id: member.id,
          role: member.role,
          isActive: member.isActive,
          name: member.user.name,
          email: member.user.email,
          userId: member.user.id,
        })),
      })
    })
  } catch (error) {
    console.error('Team members GET error:', error)
    return NextResponse.json({ error: 'Failed to load team members' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'team-members-create', limit: 20, windowMs: 60_000 })
    if (limited) return limited

    return withRequestOrgContext(request, async (context) => {
      const parsed = await parseJsonBody(request, inviteSchema)
      if (!parsed.success) return parsed.response

      const existing = await db.user.findUnique({
        where: { email: parsed.data.email.toLowerCase() },
        select: { id: true, organizationId: true },
      })
      if (existing) {
        return NextResponse.json({ error: 'A user with that email already exists.' }, { status: 409 })
      }

      const inviteToken = createSessionToken()
      const inviteTokenExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString()
      const inviteBaseUrl = request.nextUrl.origin
      const member = await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: parsed.data.email.toLowerCase(),
            name: parsed.data.name.trim(),
            role: parsed.data.role === 'agent' || parsed.data.role === 'viewer' ? 'member' : parsed.data.role,
            organizationId: context.organizationId,
            preferences: {
              invitedAt: new Date().toISOString(),
              inviteTokenHash: hashSessionToken(inviteToken),
              inviteTokenExpiresAt,
            },
          },
        })

        const teamMember = await tx.teamMember.create({
          data: {
            organizationId: context.organizationId,
            userId: user.id,
            role: parsed.data.role,
            isActive: true,
          },
        })

        await tx.auditLog.create({
          data: {
            organizationId: context.organizationId,
            action: 'create',
            entityType: 'team_member',
            entityId: teamMember.id,
            actorId: context.userId,
            actorEmail: parsed.data.email.toLowerCase(),
            description: `Invited ${parsed.data.name.trim()} to the team`,
            metadata: { role: parsed.data.role, inviteTokenExpiresAt },
          },
        })

        return { user, teamMember }
      })

      const inviteLink = `${inviteBaseUrl}/auth/invite?email=${encodeURIComponent(member.user.email)}&token=${encodeURIComponent(inviteToken)}`

      return NextResponse.json({
        member: {
          id: member.teamMember.id,
          role: member.teamMember.role,
          isActive: member.teamMember.isActive,
          name: member.user.name,
          email: member.user.email,
          userId: member.user.id,
        },
        inviteLink,
        inviteExpiresAt: inviteTokenExpiresAt,
      })
    })
  } catch (error) {
    console.error('Team members POST error:', error)
    return NextResponse.json({ error: 'Failed to invite team member' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'team-members-update', limit: 40, windowMs: 60_000 })
    if (limited) return limited

    return withRequestOrgContext(request, async (context) => {
      const id = request.nextUrl.searchParams.get('id')
      if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
      const parsed = await parseJsonBody(request, patchSchema)
      if (!parsed.success) return parsed.response

      const updated = await db.teamMember.updateMany({
        where: { id, organizationId: context.organizationId },
        data: {
          role: parsed.data.role,
          isActive: parsed.data.isActive,
        },
      })
      if (updated.count === 0) return NextResponse.json({ error: 'Team member not found' }, { status: 404 })

      await db.auditLog.create({
        data: {
          organizationId: context.organizationId,
          action: 'update',
          entityType: 'team_member',
          entityId: id,
          actorId: context.userId,
          description: 'Updated team member settings',
          metadata: parsed.data,
        },
      })

      return NextResponse.json({ success: true })
    })
  } catch (error) {
    console.error('Team members PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update team member' }, { status: 500 })
  }
}
