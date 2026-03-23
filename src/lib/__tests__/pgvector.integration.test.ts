/**
 * Test suite for pgvector extension
 *
 * This test verifies that the pgvector extension is properly enabled
 * and can be used for storing and querying embeddings.
 *
 * NOTE: This is an integration test that requires a real database connection.
 * Run with: DATABASE_URL="your-db-url" npm test pgvector.test.ts
 */

import { PrismaClient } from '@prisma/client';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Use test.runIf to conditionally run tests
const shouldRun = !!process.env.DATABASE_URL;

describe('pgvector Extension', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    if (!shouldRun) return;
    try {
      prisma = new PrismaClient();
      await prisma.$connect();
    } catch {
      // Will be caught by test skip
    }
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it.runIf(shouldRun)('should have pgvector extension enabled', async () => {
    // Check if vector extension exists
    const result = await prisma.$queryRaw<Array<{extname: string}>>`
      SELECT extname
      FROM pg_extension
      WHERE extname = 'vector'
    `;

    expect(result).toHaveLength(1);
    expect(result[0]?.extname).toBe('vector');
  });

  it.runIf(shouldRun)('should support vector column type', async () => {
    // Try to create a test table with vector column
    try {
      await prisma.$queryRaw`
        CREATE TABLE IF NOT EXISTS test_vector_table (
          id SERIAL PRIMARY KEY,
          embedding vector(1536)
        )
      `;

      // Insert a test vector
      await prisma.$queryRaw`
        INSERT INTO test_vector_table (embedding)
        VALUES ('[0.1,0.2,0.3]'::vector || array_fill(0, ARRAY[1533])::real[])
      `;

      // Query the vector
      const result = await prisma.$queryRaw`
        SELECT embedding FROM test_vector_table LIMIT 1
      `;

      expect(result).toBeTruthy();

      // Clean up
      await prisma.$queryRaw`DROP TABLE IF EXISTS test_vector_table`;
    } catch (error) {
      throw new Error(`Vector type not supported: ${error}`);
    }
  });

  it.runIf(shouldRun)('should support vector similarity search', async () => {
    try {
      // Create test table
      await prisma.$queryRaw`
        CREATE TEMP TABLE test_similarity (
          id SERIAL PRIMARY KEY,
          embedding vector(1536)
        )
      `;

      // Insert test vectors
      const testVector = Array.from({ length: 1536 }, () => Math.random());
      await prisma.$queryRaw`
        INSERT INTO test_similarity (embedding)
        VALUES (${testVector}::real[]::vector)
      `;

      // Test cosine similarity search
      const result = await prisma.$queryRaw`
        SELECT id, embedding <=> ${testVector}::real[]::vector as distance
        FROM test_similarity
        ORDER BY distance
        LIMIT 5
      `;

      expect(result).toBeTruthy();
      expect(Array.isArray(result)).toBe(true);
    } catch (error) {
      throw new Error(`Vector similarity search not supported: ${error}`);
    }
  });
});
