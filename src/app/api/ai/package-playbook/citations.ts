export type KnowledgeCitation = {
  packageId: string | null
  packageName: string
  documentId: string
  documentName: string
  chunkIndex: number
  snippet: string
}

export type PlaybookCitation = {
  packageId: string | null
  packageName: string
  documentId: string
  documentName: string
  chunkIndex: number
  snippet: string
}

export function buildKnowledgeCitations(knowledgeContext: KnowledgeCitation[]): PlaybookCitation[] {
  return knowledgeContext
    .filter((citation) => citation.snippet.trim().length >= 50)
    .map((citation) => ({
      packageId: citation.packageId,
      packageName: citation.packageName,
      documentId: citation.documentId,
      documentName: citation.documentName,
      chunkIndex: citation.chunkIndex,
      snippet: citation.snippet,
    }))
    .slice(0, 6)
}
