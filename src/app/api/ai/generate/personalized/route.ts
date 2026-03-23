import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { withRequestOrgContext } from '@/lib/request-context'
import { db } from '@/lib/db'
import { zaiChatJson } from '@/lib/zai'
import { retrieveSimilarEvents, getSuccessfulPatterns } from '@/lib/rag-retrieval'

const personalizedGenSchema = z.object({
  task: z.enum(['sms', 'email', 'playbook', 'content']),
  context: z.record(z.string(), z.unknown()),
  leadProfession: z.string().optional(),
})

/**
 * POST /api/ai/generate/personalized
 *
 * Generates AI content using the user's learned patterns:
 * 1. Retrieves user's AI profile with successful patterns
 * 2. Builds personalization context from past successes
 * 3. Includes profession-specific success rates if available
 * 4. Generates content matching the user's successful style
 *
 * Rate limited to 30 requests per minute.
 */
export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, {
      key: 'ai-personalized',
      limit: 30,
      windowMs: 60_000,
    })
    if (limited) return limited

    return withRequestOrgContext(request, async (context) => {
      const parsed = await parseJsonBody(request, personalizedGenSchema)
      if (!parsed.success) return parsed.response

      const { task, context: taskContext, leadProfession } = parsed.data
      const userId = context.userId || 'unknown'

      // Get user's learned profile
      const profile = await db.userAIProfile.findUnique({
        where: { userId },
      })

      // RAG: Retrieve similar past events and successful patterns
      const similarEvents = await retrieveSimilarEvents(
        userId,
        taskContext,
        task,
        3
      )

      const successfulPatterns = await getSuccessfulPatterns(userId, task, 5)

      let personalizationContext = ''

      // Add learned patterns to prompt
      if (profile) {
        if (task === 'sms' && profile.smsPatterns) {
          const successful = (profile.smsPatterns as any).successfulTemplates || []
          if (successful.length > 0) {
            personalizationContext += `\n\nUser's successful SMS patterns (learned from ${successful.length} successful outcomes):\n${JSON.stringify(successful.slice(-3))}\n`
          }
        }

        if (task === 'email' && profile.emailPatterns) {
          const successful = (profile.emailPatterns as any).successfulTemplates || []
          if (successful.length > 0) {
            personalizationContext += `\n\nUser's successful email patterns (learned from ${successful.length} successful outcomes):\n${JSON.stringify(successful.slice(-3))}\n`
          }
        }

        if (leadProfession && profile.industryKnowledge) {
          const industryData = (profile.industryKnowledge as any)[leadProfession]
          if (industryData) {
            const successRate = (industryData.success / industryData.total * 100).toFixed(0)
            personalizationContext += `\n\nSuccess patterns for ${leadProfession}:\n- Success rate: ${successRate}% (${industryData.success}/${industryData.total} attempts)\n- Use communication style that has worked for this industry\n`
          }
        }
      }

      // Add RAG context from similar events
      let ragContext = ''
      if (similarEvents.length > 0) {
        ragContext += `\n\nSimilar past interactions (by semantic similarity):\n${JSON.stringify(similarEvents.map(e => ({ input: e.input, output: e.output, outcome: e.outcome })))}\n`
      }

      if (successfulPatterns.length > 0) {
        ragContext += `\n\nUser's successful patterns for this task type:\n${JSON.stringify(successfulPatterns.map(e => e.output))}\n`
      }

      // Build prompt with personalization and RAG
      const prompt = `Generate a ${task} for this CRM task.

Task context:
${JSON.stringify(taskContext)}
${personalizationContext}
${ragContext}

Generate in a style that matches the user's successful patterns above. Use insights from similar past interactions. If profession-specific patterns are shown, tailor the content to that industry's preferences.

Respond with JSON containing the generated result. For SMS, include the message text. For email, include subject and body. For content, include the full text.`

      const result = await zaiChatJson(prompt)

      // Track this generation for future learning
      // (Note: In production, you'd call trackAIEvent here)

      return NextResponse.json({
        result,
        personalized: !!personalizationContext,
        hasLearnedPatterns: !!profile,
      })
    })
  } catch (error) {
    console.error('Personalized generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate personalized content' },
      { status: 500 }
    )
  }
}
