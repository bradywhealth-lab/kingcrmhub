/**
 * Script to enable pgvector extension on the database
 * Run with: npx tsx scripts/enable-pgvector.ts
 */

import { db } from '../src/lib/db';

async function enablePgvector() {
  try {
    console.log('Enabling pgvector extension...');

    // Enable the vector extension
    await db.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector;`;

    console.log('✓ pgvector extension enabled successfully');

    // Verify it's enabled
    const result = await db.$queryRaw<Array<{ extname: string; extversion: string }>>`
      SELECT extname, extversion
      FROM pg_extension
      WHERE extname = 'vector'
    `;

    if (result && result.length > 0) {
      console.log(`✓ pgvector version: ${result[0].extversion}`);
    } else {
      console.log('✗ Failed to verify pgvector extension');
    }

  } catch (error) {
    console.error('Error enabling pgvector:', error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

enablePgvector()
  .then(() => {
    console.log('\n✓ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Script failed:', error);
    process.exit(1);
  });
