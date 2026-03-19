export type KnowledgeCitation = {
  carrierId: string | null
  carrierName: string
  documentId: string
  documentName: string
  chunkIndex: number
  snippet: string
}

export type PlaybookCitation = {
  carrierId: string | null
  carrierName: string
  documentId: string
  documentName: string
  chunkIndex: number
  snippet: string
}

export function buildKnowledgeCitations(knowledgeContext: KnowledgeCitation[]): PlaybookCitation[] {
  return knowledgeContext
    .filter((citation) => citation.snippet.trim().length >= 50)
    .map((citation) => ({
      carrierId: citation.carrierId,
      carrierName: citation.carrierName,
      documentId: citation.documentId,
      documentName: citation.documentName,
      chunkIndex: citation.chunkIndex,
      snippet: citation.snippet,
    }))
    .slice(0, 6)
}
