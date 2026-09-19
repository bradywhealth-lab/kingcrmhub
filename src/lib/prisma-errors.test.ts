import { describe, expect, it } from 'vitest'
import { Prisma } from '@prisma/client'
import { isUniqueConstraintViolation } from './prisma-errors'

function knownRequestError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('prisma error', {
    code,
    clientVersion: '7.7.0',
  })
}

describe('isUniqueConstraintViolation (t_f10ef70d)', () => {
  it('detects a real PrismaClientKnownRequestError with code P2002', () => {
    expect(isUniqueConstraintViolation(knownRequestError('P2002'))).toBe(true)
  })

  it('rejects other Prisma known-request error codes', () => {
    // P2003 = FK constraint failure, P2025 = record not found: must stay 500/other.
    expect(isUniqueConstraintViolation(knownRequestError('P2003'))).toBe(false)
    expect(isUniqueConstraintViolation(knownRequestError('P2025'))).toBe(false)
  })

  it('rejects plain errors and non-objects', () => {
    expect(isUniqueConstraintViolation(new Error('P2002 mentioned in text'))).toBe(false)
    expect(isUniqueConstraintViolation(null)).toBe(false)
    expect(isUniqueConstraintViolation(undefined)).toBe(false)
    expect(isUniqueConstraintViolation('P2002')).toBe(false)
  })

  it('detects P2002 by duck-typing when instanceof fails (duplicate @prisma/client copies)', () => {
    expect(isUniqueConstraintViolation({ code: 'P2002' })).toBe(true)
    expect(isUniqueConstraintViolation({ code: 'P2003' })).toBe(false)
  })
})
