import { describe, expect, it } from 'vitest'
import { buildKnowledgeCitations } from './citations'

describe('buildKnowledgeCitations', () => {
  it('keeps only schema fields and drops short snippets', () => {
    const input: Array<
      Parameters<typeof buildKnowledgeCitations>[0][number] & { citationId: number }
    > = [
      {
        packageId: 'package_1',
        packageName: 'Package One',
        documentId: 'doc_1',
        documentName: 'Underwriting Guide',
        chunkIndex: 3,
        snippet:
          'This underwriting excerpt is intentionally longer than fifty characters so it passes the filter.',
        citationId: 99,
      },
      {
        packageId: 'package_2',
        packageName: 'Package Two',
        documentId: 'doc_2',
        documentName: 'Product Sheet',
        chunkIndex: 1,
        snippet: 'Too short',
        citationId: 100,
      },
    ]

    const citations = buildKnowledgeCitations(input)

    expect(citations).toHaveLength(1)
    expect(citations[0]).toEqual({
      packageId: 'package_1',
      packageName: 'Package One',
      documentId: 'doc_1',
      documentName: 'Underwriting Guide',
      chunkIndex: 3,
      snippet:
        'This underwriting excerpt is intentionally longer than fifty characters so it passes the filter.',
    })
    expect(citations[0]).not.toHaveProperty('citationId')
  })
})
