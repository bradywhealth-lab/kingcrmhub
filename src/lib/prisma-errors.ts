import { Prisma } from '@prisma/client'

/**
 * True when the error is a Prisma P2002 unique-constraint violation.
 *
 * Checks `instanceof Prisma.PrismaClientKnownRequestError` first, then falls
 * back to duck-typing `code === 'P2002'` so the detection still works if a
 * duplicate @prisma/client copy breaks the prototype chain.
 *
 * Used by API routes to map unique-constraint races/collisions to 409 with a
 * clear client-safe message, while genuine unexpected errors stay 500
 * (same principle as the storage error-class mapping in PR #184).
 */
export function isUniqueConstraintViolation(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2002'
  }
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'P2002'
  )
}
