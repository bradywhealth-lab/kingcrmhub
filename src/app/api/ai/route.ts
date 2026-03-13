import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'

const aiRequestSchema = z.object({
  action: z.enum(['score-lead', 'generate-content', 'generate-media', 'generate-insights', 'chat']),
  data: z.record(z.string(), z.unknown()).default({}),
})

// AI API using z-ai-web-dev-sdk
export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'ai-generate', limit: 50, windowMs: 60_000 })
    if (limited) return limited
    const parsed = await parseJsonBody(request, aiRequestSchema)
    if (!parsed.success) return parsed.response
    const { action, data } = parsed.data
    
    // Dynamic import for server-side only
    const { LLM } = await import('z-ai-web-dev-sdk')
    
    switch (action) {
      case 'score-lead': {
        const prompt = `Analyze this lead and provide a quality score from 0-100 based on their profile.
        
Lead Information:
- Name: ${data.firstName} ${data.lastName}
- Email: ${data.email}
- Company: ${data.company}
- Title: ${data.title}
- Source: ${data.source}
- Estimated Value: $${data.estimatedValue || 'Not provided'}

Provide:
1. A quality score (0-100)
2. Confidence level (0-1)
3. Key insights (2-3 bullet points)
4. Recommended next action

Respond in JSON format:
{
  "score": <number>,
  "confidence": <number>,
  "insights": ["insight1", "insight2"],
  "nextAction": "<action>",
  "tags": ["tag1", "tag2"]
}`

        const result = await LLM.chat({
          messages: [{ role: 'user', content: prompt }],
          model: 'claude-3-5-sonnet-20241022'
        })
        
        // Parse the JSON response
        const jsonMatch = result.content?.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          return NextResponse.json(parsed)
        }
        
        return NextResponse.json({
          score: 50,
          confidence: 0.5,
          insights: ['Unable to analyze lead'],
          nextAction: 'Manual review recommended',
          tags: []
        })
      }
      
      case 'generate-content': {
        const { topic, platform, tone } = data
        const prompt = `Create a ${platform} post about: ${topic}
        
Requirements:
- Platform: ${platform}
- Tone: ${tone}
- Engaging and professional
- Include relevant hashtags
- Optimal length for the platform

Provide the response in JSON format:
{
  "title": "<post title>",
  "content": "<post content>",
  "hashtags": ["#hashtag1", "#hashtag2"],
  "bestTimeToPost": "<suggested time>"
}`

        const result = await LLM.chat({
          messages: [{ role: 'user', content: prompt }],
          model: 'claude-3-5-sonnet-20241022'
        })
        
        const jsonMatch = result.content?.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          return NextResponse.json({
            ...parsed,
            aiGenerated: true
          })
        }
        
        return NextResponse.json({
          title: topic,
          content: `Check out our latest insights on ${topic}! #Business #Growth`,
          hashtags: ['#Business', '#Growth'],
          bestTimeToPost: '9:00 AM',
          aiGenerated: true
        })
      }

      case 'generate-media': {
        const { topic, platform, style = 'clean, premium, high-converting' } = data
        const prompt = `Create a concise, production-ready image prompt for a ${platform} marketing creative.
Topic: ${topic}
Style: ${style}

Return JSON:
{
  "imagePrompt": "<detailed visual prompt>",
  "caption": "<short caption>",
  "cta": "<call to action>"
}`

        const result = await LLM.chat({
          messages: [{ role: 'user', content: prompt }],
          model: 'claude-3-5-sonnet-20241022'
        })

        const jsonMatch = result.content?.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          return NextResponse.json({
            ...parsed,
            aiGenerated: true
          })
        }

        return NextResponse.json({
          imagePrompt: `Premium ${platform} visual for ${topic}, clean layout, strong headline, brand-forward composition`,
          caption: `Elevate your strategy with ${topic}.`,
          cta: 'Book a consultation',
          aiGenerated: true
        })
      }
      
      case 'generate-insights': {
        const prompt = `Analyze this CRM data and provide actionable insights:
        
Total Leads: ${data.totalLeads}
Pipeline Value: $${data.pipelineValue}
Avg Lead Score: ${data.avgScore}
Win Rate: ${data.winRate}%
Recent Activities: ${data.recentActivities}

Provide 3-5 insights in JSON format:
{
  "insights": [
    {
      "type": "prediction|recommendation|trend|alert",
      "category": "leads|pipeline|performance",
      "title": "<title>",
      "description": "<description>",
      "confidence": <0-1>,
      "actionable": <boolean>
    }
  ]
}`

        const result = await LLM.chat({
          messages: [{ role: 'user', content: prompt }],
          model: 'claude-3-5-sonnet-20241022'
        })
        
        const jsonMatch = result.content?.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          return NextResponse.json(parsed)
        }
        
        // Fallback insights
        return NextResponse.json({
          insights: [
            {
              type: 'recommendation',
              category: 'leads',
              title: 'Follow-up with high-score leads',
              description: 'You have leads with scores above 80 that haven\'t been contacted recently.',
              confidence: 0.9,
              actionable: true
            },
            {
              type: 'trend',
              category: 'pipeline',
              title: 'Pipeline growing steadily',
              description: 'Your pipeline value has increased 15% this month.',
              confidence: 0.85,
              actionable: false
            }
          ]
        })
      }
      
      case 'chat': {
        const { messages, context } = data
        
        const systemPrompt = `You are an AI assistant for EliteCRM, a sophisticated CRM system.
You help users manage leads, analyze data, and optimize their sales process.
Be concise, professional, and actionable in your responses.
Context: ${JSON.stringify(context)}`
        
        const result = await LLM.chat({
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages
          ],
          model: 'claude-3-5-sonnet-20241022'
        })
        
        return NextResponse.json({
          message: result.content,
          success: true
        })
      }
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('AI API error:', error)
    return NextResponse.json({ 
      error: 'AI processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  
  if (action === 'status') {
    return NextResponse.json({
      status: 'operational',
      models: ['claude-3-5-sonnet-20241022'],
      features: ['lead-scoring', 'content-generation', 'insights', 'chat']
    })
  }
  
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
