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

/**
 * Serializes a full Prisma row to the public document shape: an explicit
 * allowlist of client-safe fields, never a spread, so server-side fields
 * (storagePath, extractedText, organizationId, indexedAt) can never leak
 * through nested responses. fileUrl is always the auth-gated download path,
 * never the persisted value (legacy public URL or M173 empty placeholder).
 */
export function serializePackageDocumentRow(document: {
  id: string
  packageId: string
  type: string
  name: string
  description: string | null
  fileType: string | null
  fileSize: number | null
  version: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: document.id,
    packageId: document.packageId,
    type: document.type,
    name: document.name,
    description: document.description,
    fileType: document.fileType,
    fileSize: document.fileSize,
    version: document.version,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    fileUrl: packageDocumentDownloadPath(document.packageId, document.id),
  }
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

/** Serializes a document row for the single-document response. */
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
