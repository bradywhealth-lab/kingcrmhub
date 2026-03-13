import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export async function parseJsonBody<TSchema extends z.ZodTypeAny>(
  request: NextRequest,
  schema: TSchema
): Promise<{ success: true; data: z.infer<TSchema> } | { success: false; response: NextResponse }> {
  const raw = await request.json().catch(() => null)
  const parsed = schema.safeParse(raw ?? {})
  if (!parsed.success) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: 'Invalid request body',
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      ),
    }
  }

  return { success: true, data: parsed.data }
}
