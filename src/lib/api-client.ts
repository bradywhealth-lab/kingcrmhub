function getConfiguredBasePath(): string {
  const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || ''
  if (!rawBasePath || rawBasePath === '/') return ''

  const withLeadingSlash = rawBasePath.startsWith('/') ? rawBasePath : `/${rawBasePath}`
  return withLeadingSlash.replace(/\/+$/, '')
}

export function buildApiPath(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${getConfiguredBasePath()}${normalizedPath}`
}

export async function readApiJsonOrText(response: Response): Promise<{ data: any | null; text: string | null }> {
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return { data: await response.json(), text: null }
  }
  return { data: null, text: await response.text() }
}
