import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * Response helper for 403 Forbidden errors
 */
function forbiddenResponse(message: string = 'Forbidden: Admin access required'): NextResponse {
  return NextResponse.json(
    { error: message },
    { status: 403 }
  )
}

/**
 * Response helper for 401 Unauthorized errors
 */
function unauthorizedResponse(message: string = 'Unauthorized: User not found'): NextResponse {
  return NextResponse.json(
    { error: message },
    { status: 401 }
  )
}

/**
 * Extract user ID from request headers
 *
 * TODO: Integrate with session/JWT authentication system
 * Currently reads from X-User-ID header for development/testing
 *
 * @param request - NextRequest object
 * @returns User ID string or null
 */
function getUserIdFromRequest(request: NextRequest): string | null {
  return request.headers.get('x-user-id')
}

/**
 * Authorization context returned when user has admin access
 */
export interface AdminAuthContext {
  userId: string
  organizationId: string
  role: string
}

/**
 * Require admin role for API route access
 *
 * Checks if the requesting user has admin or owner role.
 * Returns auth context on success, error response on failure.
 *
 * @param request - NextRequest object
 * @returns AdminAuthContext or NextResponse error
 */
export async function requireAdminRole(
  request: NextRequest
): Promise<AdminAuthContext | NextResponse> {
  const userId = getUserIdFromRequest(request)

  if (!userId) {
    return unauthorizedResponse('User ID not provided')
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      organizationId: true
    }
  })

  if (!user) {
    return unauthorizedResponse('User not found')
  }

  // Check role directly from fetched user (avoid N+1 query)
  if (user.role !== 'admin' && user.role !== 'owner') {
    return forbiddenResponse()
  }

  return {
    userId: user.id,
    organizationId: user.organizationId || '',
    role: user.role
  }
}

/**
 * Higher-order function to wrap API route handlers with admin auth
 *
 * Usage:
 * ```ts
 * export const GET = withAdminAuth(async (request, context) => {
 *   // context.userId and context.organizationId available here
 *   return NextResponse.json({ data: 'sensitive admin data' })
 * })
 * ```
 *
 * @param handler - API route handler function
 * @returns Wrapped API route handler
 */
export function withAdminAuth<T extends NextResponse>(
  handler: (
    request: NextRequest,
    context: AdminAuthContext
  ) => Promise<T> | T
) {
  return async (request: NextRequest): Promise<T | NextResponse> => {
    const authResult = await requireAdminRole(request)

    if (authResult instanceof NextResponse) {
      return authResult
    }

    return handler(request, authResult)
  }
}

/**
 * Check if user has admin or owner role
 *
 * @param userId - User ID string
 * @returns true if user is admin or owner
 */
export async function isAdminUser(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true }
  })

  return user?.role === 'admin' || user?.role === 'owner' || false
}
