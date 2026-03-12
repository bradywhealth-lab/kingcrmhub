import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

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
  console.log('Created organization:', organization.name)

  // Create demo user
  const user = await prisma.user.upsert({
    where: { email: 'john@demo.com' },
    update: {},
    create: {
      id: 'demo-user-1',
      email: 'john@demo.com',
      name: 'John Doe',
      role: 'owner',
      organizationId: organization.id
    }
  })
  console.log('Created user:', user.name)

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
  console.log('Created pipeline:', pipeline.name)

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
  console.log('Created', stages.length, 'pipeline stages')

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
    },
    {
      id: 'lead-4',
      firstName: 'James',
      lastName: 'Wilson',
      email: 'jwilson@agency.co',
      phone: '15554567890',
      company: 'Creative Agency',
      title: 'Director',
      source: 'google',
      status: 'negotiation',
      aiScore: 88,
      aiConfidence: 0.91,
      aiInsights: { intent: 'high', decisionMaker: true },
      aiNextAction: 'Send contract',
      estimatedValue: 120000,
      organizationId: organization.id
    },
    {
      id: 'lead-5',
      firstName: 'Lisa',
      lastName: 'Anderson',
      email: 'lisa@retail.com',
      phone: '15555678901',
      company: 'Retail Giants',
      title: 'CEO',
      source: 'referral',
      status: 'new',
      aiScore: 65,
      aiConfidence: 0.68,
      aiInsights: {},
      aiNextAction: 'Research company needs',
      estimatedValue: 30000,
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
  console.log('Created', leads.length, 'sample leads')

  // Create pipeline items for leads
  const pipelineItems = [
    { id: 'item-1', title: 'Michael Chen - Startup.io', value: 25000, probability: 20, stageId: 'stage-new', leadId: 'lead-2', pipelineId: pipeline.id, aiWinProbability: 0.35 },
    { id: 'item-2', title: 'Lisa Anderson - Retail Giants', value: 30000, probability: 15, stageId: 'stage-new', leadId: 'lead-5', pipelineId: pipeline.id, aiWinProbability: 0.28 },
    { id: 'item-3', title: 'Sarah Johnson - TechCorp', value: 50000, probability: 60, stageId: 'stage-qualified', leadId: 'lead-1', pipelineId: pipeline.id, aiWinProbability: 0.72 },
    { id: 'item-4', title: 'Emily Davis - Enterprise', value: 75000, probability: 70, stageId: 'stage-proposal', leadId: 'lead-3', pipelineId: pipeline.id, aiWinProbability: 0.68 },
    { id: 'item-5', title: 'James Wilson - Agency', value: 120000, probability: 85, stageId: 'stage-negotiation', leadId: 'lead-4', pipelineId: pipeline.id, aiWinProbability: 0.89 },
  ]

  for (const item of pipelineItems) {
    await prisma.pipelineItem.upsert({
      where: { id: item.id },
      update: {},
      create: {
        ...item,
        expectedClose: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    })
  }
  console.log('Created', pipelineItems.length, 'pipeline items')

  // Create AI insights
  const insights = [
    {
      id: 'insight-1',
      type: 'prediction',
      category: 'pipeline',
      title: 'Revenue Forecast',
      description: "Based on current pipeline velocity, you're projected to close $280K this quarter",
      data: { confidence: 0.82 },
      confidence: 0.82,
      actionable: true,
      organizationId: organization.id
    },
    {
      id: 'insight-2',
      type: 'recommendation',
      category: 'leads',
      title: 'Follow-up Alert',
      description: '3 leads haven\'t been contacted in 7+ days. Immediate outreach recommended.',
      data: { leads: ['lead-2', 'lead-5'] },
      confidence: 0.95,
      actionable: true,
      organizationId: organization.id
    },
    {
      id: 'insight-3',
      type: 'trend',
      category: 'performance',
      title: 'Conversion Rate Up',
      description: 'Your lead-to-opportunity conversion increased 12% this month',
      data: { change: 0.12 },
      confidence: 0.88,
      actionable: false,
      organizationId: organization.id
    },
    {
      id: 'insight-4',
      type: 'alert',
      category: 'pipeline',
      title: 'Deal at Risk',
      description: 'James Wilson deal hasn\'t had activity in 5 days. Consider reaching out.',
      data: { dealId: 'item-5' },
      confidence: 0.76,
      actionable: true,
      organizationId: organization.id
    }
  ]

  for (const insight of insights) {
    await prisma.aIInsight.upsert({
      where: { id: insight.id },
      update: {},
      create: insight
    })
  }
  console.log('Created', insights.length, 'AI insights')

  // Create activities
  const activities = [
    {
      id: 'activity-1',
      type: 'email',
      title: 'Sent proposal to Sarah Johnson',
      description: 'Follow-up email with pricing',
      metadata: { opened: true },
      aiSummary: 'Lead showed interest in premium plan',
      organizationId: organization.id,
      leadId: 'lead-1'
    },
    {
      id: 'activity-2',
      type: 'call',
      title: 'Discovery call with James Wilson',
      description: 'Discussed requirements and timeline',
      metadata: { duration: 45 },
      aiSummary: 'Decision maker engaged, ready for proposal',
      organizationId: organization.id,
      leadId: 'lead-4'
    },
    {
      id: 'activity-3',
      type: 'ai_analysis',
      title: 'AI scored new lead',
      description: 'Michael Chen scored 78/100',
      metadata: { score: 78 },
      aiSummary: 'High potential - immediate follow-up recommended',
      organizationId: organization.id,
      leadId: 'lead-2'
    }
  ]

  for (const activity of activities) {
    await prisma.activity.upsert({
      where: { id: activity.id },
      update: {},
      create: activity
    })
  }
  console.log('Created', activities.length, 'activities')

  // Create sample automations
  const automations = [
    {
      id: 'automation-1',
      name: 'Auto-score new leads',
      description: 'Automatically score new leads with AI',
      trigger: 'lead_created',
      conditions: {},
      actions: [{ type: 'ai_score' }],
      isActive: true,
      organizationId: organization.id
    },
    {
      id: 'automation-2',
      name: 'Welcome email sequence',
      description: 'Send welcome email to new leads',
      trigger: 'lead_created',
      conditions: { aiScore: { gte: 60 } },
      actions: [{ type: 'send_email', template: 'welcome' }],
      isActive: true,
      organizationId: organization.id
    }
  ]

  for (const automation of automations) {
    await prisma.automation.upsert({
      where: { id: automation.id },
      update: {},
      create: automation
    })
  }
  console.log('Created', automations.length, 'automations')

  console.log('Database seeding completed!')
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
