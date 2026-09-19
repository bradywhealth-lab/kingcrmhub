/**
 * Shared serialization for package-document API responses.
 *
 * M173: raw object paths and public bucket URLs must NEVER leave the server.
 * Every response embeds a relative, auth-gated download URL instead, so
 * unauthenticated access is impossible and cross-tenant fetches 404 at the
 * route. Both document routes import these canonical helpers — duplicate
 * per-route copies drifted apart before (PR #184 per-route constants).
 */

import type { PackageDocumentChunk } from '@prisma/client'

/** The auth-gated download endpoint for a document. */
export function packageDocumentDownloadPath(packageId: string, docId: string): string {
  return `/api/packages/${encodeURIComponent(packageId)}/documents/${encodeURIComponent(docId)}/download`
}

export type PackageDocumentListItem = {
  id: string
  packageId: string
  type: string
  name: string
  description: string | null
  fileType: string | null
  fileSize: number | null
  version: string | null
  createdAt: Date
}

/** Serializes a document row for the package-documents list response. */
export function serializePackageDocument(document: PackageDocumentListItem) {
  const { id, packageId, type, name, description, fileType, fileSize, version, createdAt } = document
  return {
    id,
    packageId,
    type,
    name,
    description,
    fileType,
    fileSize,
    version,
    createdAt,
    fileUrl: packageDocumentDownloadPath(packageId, id),
  }
}

export type PackageDocumentDetail = PackageDocumentListItem & {
  updatedAt: Date
  chunks: PackageDocumentChunk[]
}

/** Serializes a document row (with chunks) for the single-document response. */
export function serializePackageDocumentDetail(document: PackageDocumentDetail) {
  const {
    id,
    packageId,
    type,
    name,
    description,
    fileType,
    fileSize,
    version,
    createdAt,
    updatedAt,
    chunks,
  } = document
  return {
    id,
    packageId,
    type,
    name,
    description,
    fileType,
    fileSize,
    version,
    createdAt,
    updatedAt,
    fileUrl: packageDocumentDownloadPath(packageId, id),
    chunks,
  }
}
