/**
 * Test for pgvector extension migration
 * This test verifies that pgvector is properly enabled and functional
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '../../../src/lib/db';

describe('pgvector Extension Migration', () => {
  beforeAll(async () => {
    // Give database time to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('should have pgvector extension enabled', async () => {
    const result = await db.$queryRaw`
      SELECT extname
      FROM pg_extension
      WHERE extname = 'vector'
    ` as Array<{ extname: string }>;

    expect(result).toHaveLength(1);
    expect(result[0].extname).toBe('vector');
  });

  it('should support vector column type', async () => {
    // Test that we can create a table with vector column
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS test_vector_table (
        id SERIAL PRIMARY KEY,
        embedding vector(1536)
      )
    `;

    // Test that we can insert vector data
    await db.$executeRaw`
      INSERT INTO test_vector_table (embedding)
      VALUES ('[0.1,0.2,0.3]'::vector || array_fill(0, ARRAY[1533]))
    `;

    // Test that we can query vector data
    const result = await db.$queryRaw`
      SELECT embedding FROM test_vector_table LIMIT 1
    ` as Array<{ embedding: number[] }>;

    expect(result).toHaveLength(1);
    expect(result[0].embedding).toBeDefined();
    expect(Array.isArray(result[0].embedding)).toBe(true);

    // Cleanup
    await db.$executeRaw`DROP TABLE IF EXISTS test_vector_table`;
  });

  it('should support vector similarity search operations', async () => {
    // Create test table
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS test_similarity (
        id SERIAL PRIMARY KEY,
        embedding vector(3)
      )
    `;

    // Insert test vectors
    await db.$executeRaw`
      INSERT INTO test_similarity (embedding) VALUES
      ('[1,2,3]'::vector),
      ('[2,3,4]'::vector),
      ('[1,1,1]'::vector)
    `;

    // Test cosine similarity search
    const result = await db.$queryRaw`
      SELECT id FROM test_similarity
      ORDER BY embedding <=> '[1,2,3]'::vector
      LIMIT 2
    ` as Array<{ id: number }>;

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].id).toBeDefined();

    // Cleanup
    await db.$executeRaw`DROP TABLE IF EXISTS test_similarity`;
  });

  it('should have vector indexes available', async () => {
    // Check that ivfflat access method is available
    const result = await db.$queryRaw`
      SELECT amname
      FROM pg_am
      WHERE amname = 'ivfflat'
    ` as Array<{ amname: string }>;

    expect(result.length).toBeGreaterThan(0);
  });
});
