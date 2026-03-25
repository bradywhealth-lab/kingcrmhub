/**
 * Seed Demo Organization Script
 *
 * Creates a demo organization and admin user for immediate login after deployment.
 *
 * Usage:
 *   npx ts-node scripts/seed-demo-org.ts
 *
 * Demo credentials:
 *   Email: john@demo.com
 *   Password: changeme123
 *
 * Note: The user will be prompted to change password on first login.
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { scryptSync, randomBytes } from 'crypto'

/**
 * Hash password using scrypt (matching the app's auth.ts implementation)
 */
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${derived}`
}

const databaseUrl = process.env.DATABASE_URL?.trim()
if (!databaseUrl) {
  throw new Error('Missing DATABASE_URL. Please set DATABASE_URL environment variable.')
}

const adapter = new PrismaPg({ connectionString: databaseUrl })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding demo organization...')

  // Create demo organization
  const organization = await prisma.organization.upsert({
    where: { id: 'demo-org-1' },
    update: {},
    create: {
      id: 'demo-org-1',
      name: 'Demo Insurance Agency',
      slug: 'demo-agency',
      plan: 'pro',
      settings: {
        theme: 'light',
        timezone: 'America/New_York',
        currency: 'USD'
      }
    }
  })
  console.log('✅ Created organization:', organization.name)

  // Hash demo password
  const hashedPassword = hashPassword('changeme123')

  // Create demo user
  const user = await prisma.user.upsert({
    where: { email: 'john@demo.com' },
    update: {},
    create: {
      id: 'demo-user-1',
      email: 'john@demo.com',
      name: 'John Doe',
      passwordHash: hashedPassword,
      role: 'owner',
      organizationId: organization.id
    }
  })
  console.log('✅ Created user:', user.name)
  console.log('   Email:', user.email)
  console.log('   Password: changeme123 (must change on first login)')

  // Create team member
  await prisma.teamMember.upsert({
    where: { id: 'demo-team-1' },
    update: {},
    create: {
      id: 'demo-team-1',
      userId: user.id,
      organizationId: organization.id,
      role: 'owner',
      maxLeads: 100,
      isActive: true
    }
  })

  // Create default pipeline with stages
  const pipeline = await prisma.pipeline.upsert({
    where: { id: 'demo-pipeline-1' },
    update: {},
    create: {
      id: 'demo-pipeline-1',
      organizationId: organization.id,
      name: 'Sales Pipeline',
      description: 'Default sales pipeline for insurance leads',
      isDefault: true,
      order: 0
    }
  })
  console.log('✅ Created pipeline:', pipeline.name)

  // Create pipeline stages
  const stages = [
    { id: 'stage-new', name: 'New', color: '#0A0A0A', order: 0, probability: 10 },
    { id: 'stage-contacted', name: 'Contacted', color: '#6B7280', order: 1, probability: 20 },
    { id: 'stage-qualified', name: 'Qualified', color: '#D4AF37', order: 2, probability: 40 },
    { id: 'stage-proposal', name: 'Proposal', color: '#0284C7', order: 3, probability: 60 },
    { id: 'stage-negotiation', name: 'Negotiation', color: '#8B7355', order: 4, probability: 80 },
    { id: 'stage-won', name: 'Won', color: '#059669', order: 5, probability: 100 },
  ]

  for (const stage of stages) {
    await prisma.pipelineStage.upsert({
      where: { id: stage.id },
      update: {},
      create: {
        id: stage.id,
        pipelineId: pipeline.id,
        name: stage.name,
        color: stage.color,
        order: stage.order,
        probability: stage.probability
      }
    })
  }
  console.log('✅ Created', stages.length, 'pipeline stages')

  // Create sample leads
  const leads = [
    {
      id: 'lead-1',
      firstName: 'Sarah',
      lastName: 'Johnson',
      email: 'sarah@techcorp.com',
      phone: '15551234567',
      company: 'TechCorp Inc',
      title: 'CTO',
      source: 'linkedin',
      status: 'qualified',
      aiScore: 92,
      aiConfidence: 0.89,
      aiInsights: { intent: 'high', budget: 'confirmed' },
      aiNextAction: 'Schedule demo call',
      estimatedValue: 50000,
      organizationId: organization.id
    },
    {
      id: 'lead-2',
      firstName: 'Michael',
      lastName: 'Chen',
      email: 'mchen@startup.io',
      phone: '15552345678',
      company: 'Startup.io',
      title: 'Founder',
      source: 'referral',
      status: 'new',
      aiScore: 78,
      aiConfidence: 0.75,
      aiInsights: { intent: 'medium' },
      aiNextAction: 'Send introductory email',
      estimatedValue: 25000,
      organizationId: organization.id
    },
    {
      id: 'lead-3',
      firstName: 'Emily',
      lastName: 'Davis',
      email: 'emily@enterprise.com',
      phone: '15553456789',
      company: 'Enterprise Solutions',
      title: 'VP of Sales',
      source: 'website',
      status: 'proposal',
      aiScore: 85,
      aiConfidence: 0.82,
      aiInsights: { intent: 'high', timeline: 'Q1' },
      aiNextAction: 'Follow up on proposal',
      estimatedValue: 75000,
      organizationId: organization.id
    }
  ]

  for (const lead of leads) {
    await prisma.lead.upsert({
      where: { id: lead.id },
      update: {},
      create: lead
    })
  }
  console.log('✅ Created', leads.length, 'sample leads')

  console.log('\n✨ Demo organization seeded successfully!')
  console.log('\n📝 Login credentials:')
  console.log('   URL: https://insurafuze-king-crm.vercel.app/auth')
  console.log('   Email: john@demo.com')
  console.log('   Password: changeme123')
  console.log('\n⚠️  You will be prompted to change password on first login.\n')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding demo organization:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
