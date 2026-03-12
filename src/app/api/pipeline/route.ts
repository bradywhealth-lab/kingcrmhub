import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/pipeline - Get pipeline with stages and items
export async function GET(request: NextRequest) {
  try {
    const organizationId = 'demo-org-1'
    const pipelineId = request.nextUrl.searchParams.get('pipelineId')
    
    // Get or create default pipeline
    let pipeline = await db.pipeline.findFirst({
      where: { 
        organizationId,
        isDefault: true 
      },
      include: {
        stages: {
          orderBy: { order: 'asc' },
          include: {
            items: {
              include: {
                lead: {
                  include: {
                    tags: {
                      include: { tag: true }
                    }
                  }
                }
              },
              orderBy: { position: 'asc' }
            }
          }
        }
      }
    })
    
    if (!pipeline) {
      // Create default pipeline with stages
      pipeline = await db.pipeline.create({
        data: {
          organizationId,
          name: 'Sales Pipeline',
          description: 'Default sales pipeline',
          isDefault: true,
          stages: {
            create: [
              { name: 'New', color: '#64748b', order: 0, probability: 10 },
              { name: 'Contacted', color: '#3b82f6', order: 1, probability: 20 },
              { name: 'Qualified', color: '#8b5cf6', order: 2, probability: 40 },
              { name: 'Proposal', color: '#f59e0b', order: 3, probability: 60 },
              { name: 'Negotiation', color: '#f97316', order: 4, probability: 80 },
              { name: 'Won', color: '#10b981', order: 5, probability: 100 },
            ]
          }
        },
        include: {
          stages: {
            orderBy: { order: 'asc' },
            include: {
              items: {
                include: {
                  lead: {
                    include: {
                      tags: {
                        include: { tag: true }
                      }
                    }
                  }
                },
                orderBy: { position: 'asc' }
              }
            }
          }
        }
      })
    }
    
    // Calculate pipeline metrics
    const totalValue = pipeline.stages.reduce((sum, stage) => 
      sum + stage.items.reduce((s, item) => s + (item.value || 0), 0), 0
    )
    
    const weightedValue = pipeline.stages.reduce((sum, stage) => 
      sum + stage.items.reduce((s, item) => {
        const prob = (stage.probability || 0) / 100
        return s + ((item.value || 0) * prob)
      }, 0), 0
    )
    
    return NextResponse.json({
      pipeline,
      metrics: {
        totalValue,
        weightedValue,
        totalItems: pipeline.stages.reduce((sum, stage) => sum + stage.items.length, 0),
        stageCount: pipeline.stages.length
      }
    })
  } catch (error) {
    console.error('Error fetching pipeline:', error)
    return NextResponse.json({ error: 'Failed to fetch pipeline' }, { status: 500 })
  }
}

// POST /api/pipeline - Create pipeline item
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const organizationId = 'demo-org-1'
    
    const pipeline = await db.pipeline.findFirst({
      where: { organizationId, isDefault: true },
      include: { stages: { orderBy: { order: 'asc' } } }
    })
    
    if (!pipeline || pipeline.stages.length === 0) {
      return NextResponse.json({ error: 'No pipeline found' }, { status: 404 })
    }
    
    const firstStage = pipeline.stages[0]
    
    const item = await db.pipelineItem.create({
      data: {
        pipelineId: pipeline.id,
        stageId: body.stageId || firstStage.id,
        leadId: body.leadId,
        title: body.title,
        value: body.value,
        probability: body.probability || firstStage.probability,
        expectedClose: body.expectedClose ? new Date(body.expectedClose) : null,
      },
      include: {
        lead: true,
        stage: true
      }
    })
    
    return NextResponse.json(item)
  } catch (error) {
    console.error('Error creating pipeline item:', error)
    return NextResponse.json({ error: 'Failed to create pipeline item' }, { status: 500 })
  }
}

// PATCH /api/pipeline - Move item between stages
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { itemId, stageId, position } = body
    
    const item = await db.pipelineItem.update({
      where: { id: itemId },
      data: {
        stageId,
        position: position || 0
      },
      include: {
        lead: true,
        stage: true
      }
    })
    
    // Update lead status if linked
    if (item.leadId) {
      const stageToStatus: Record<string, string> = {
        'new': 'new',
        'contacted': 'contacted',
        'qualified': 'qualified',
        'proposal': 'proposal',
        'negotiation': 'negotiation',
        'won': 'won'
      }
      
      const status = stageToStatus[item.stage?.name.toLowerCase() || '']
      if (status) {
        await db.lead.update({
          where: { id: item.leadId },
          data: { status }
        })
      }
    }
    
    return NextResponse.json(item)
  } catch (error) {
    console.error('Error moving pipeline item:', error)
    return NextResponse.json({ error: 'Failed to move item' }, { status: 500 })
  }
}
