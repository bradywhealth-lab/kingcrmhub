import { NextResponse } from 'next/server'

export function apiError(message: string, status: number, code?: string) {
  return NextResponse.json(
    {
      error: message,
      ...(code ? { code } : {}),
    },
    { status }
  )
}
