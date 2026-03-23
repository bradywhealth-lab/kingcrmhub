/**
 * Pinecone Integration Test
 *
 * Tests the complete AI Learning flow with Pinecone:
 * 1. Create event → sync to Pinecone
 * 2. Retrieve similar events via RAG
 *
 * This is an OPTIONAL integration test that requires real Pinecone credentials.
 * The test will skip gracefully if Pinecone is not configured.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db } from '@/lib/db'
import { trackAIEvent, recordEventOutcome } from '@/lib/ai-tracking'
import { retrieveSimilarEvents } from '@/lib/rag-retrieval'
import { PineconeClient } from '@/lib/pinecone-client'

// Test suite - will skip if Pinecone is not configured
const describeIfPinecone = process.env.PINECONE_API_KEY ? describe : describe.skip

describeIfPinecone('Pinecone Integration', () => {
  // Test data
  let testUserId: string
  let testOrganizationId: string
  let testEventId: string
  let testPineconeId: string | undefined

  beforeAll(async () => {
    // Initialize Pinecone client
    await PineconeClient.initialize()

    // Create test organization
    const organization = await db.organization.create({
      data: {
        name: 'Pinecone Test Organization',
        slug: `pinecone-test-${Date.now()}`,
        plan: 'free',
      },
    })
    testOrganizationId = organization.id

    // Create test user
    const user = await db.user.create({
      data: {
        email: `pinecone-test-${Date.now()}@example.com`,
        organizationId: testOrganizationId,
        role: 'admin',
      },
    })
    testUserId = user.id
  })

  afterAll(async () => {
    // Clean up test data
    try {
      // Delete any Pinecone vectors created during test
      if (testPineconeId) {
        await PineconeClient.deleteEvent(testPineconeId, testOrganizationId)
      }

      // Delete test user (cascade to profile and events)
      await db.user.delete({
        where: { id: testUserId },
      })

      // Delete test organization
      await db.organization.delete({
        where: { id: testOrganizationId },
      })
    } catch (error) {
      console.error('Cleanup error:', error)
    }
  })

  it('should create event and sync to Pinecone', async () => {
    const result = await trackAIEvent(
      testUserId,
      'sms_sent',
      'lead',
      `lead-${Date.now()}`,
      {
        template: 'follow-up-1',
        leadName: 'John Doe',
        profession: 'Contractor',
      },
      {
        smsText: 'Hey John, just checking in on your project...',
      },
      {
        leadProfession: 'Contractor',
        sourceType: 'website',
        syncToPinecone: true,
      }
    )

    expect(result).toBeDefined()
    expect(result.eventId).toBeDefined()
    expect(result.pineconeId).toBeDefined()

    testEventId = result.eventId
    testPineconeId = result.pineconeId

    // Verify event was created in database
    const event = await db.userLearningEvent.findUnique({
      where: { id: result.eventId },
      include: { userProfile: true },
    })

    expect(event).toBeDefined()
    expect(event?.eventType).toBe('sms_sent')
    expect(event?.pineconeId).toBe(result.pineconeId)
  })

  it('should retrieve similar events via RAG', async () => {
    // Wait a moment for Pinecone index to update
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Create a few more events for better retrieval testing
    await trackAIEvent(
      testUserId,
      'sms_sent',
      'lead',
      `lead-${Date.now()}`,
      {
        template: 'follow-up-1',
        leadName: 'Jane Smith',
        profession: 'Contractor',
      },
      {
        smsText: 'Hi Jane, following up on your inquiry...',
      },
      {
        leadProfession: 'Contractor',
        sourceType: 'website',
        syncToPinecone: true,
      }
    )

    await trackAIEvent(
      testUserId,
      'email_sent',
      'lead',
      `lead-${Date.now()}`,
      {
        template: 'intro-email',
        leadName: 'Bob Johnson',
        profession: 'Electrician',
      },
      {
        emailSubject: 'Introduction to our services',
        emailBody: 'Hi Bob, I wanted to introduce our company...',
      },
      {
        leadProfession: 'Electrician',
        sourceType: 'referral',
        syncToPinecone: true,
      }
    )

    // Wait for Pinecone to index
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Retrieve similar events using a query similar to our first event
    const results = await retrieveSimilarEvents(
      testUserId,
      {
        template: 'follow-up-1',
        leadName: 'Test Contractor',
        profession: 'Contractor',
      },
      'sms_sent',
      5,
      {
        usePinecone: true,
        minSimilarity: 0.0, // Lower threshold for testing
        organizationId: testOrganizationId,
      }
    )

    expect(results).toBeDefined()
    expect(Array.isArray(results)).toBe(true)

    // Should find at least our similar SMS events
    expect(results.length).toBeGreaterThan(0)

    // Results should have expected structure
    results.forEach((result) => {
      expect(result).toHaveProperty('id')
      expect(result).toHaveProperty('eventType')
      expect(result).toHaveProperty('similarity')
      expect(result).toHaveProperty('input')
      expect(result).toHaveProperty('output')
    })

    // Results should be sorted by similarity (highest first)
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].similarity).toBeGreaterThanOrEqual(results[i].similarity)
    }
  })

  it('should update outcome and sync to Pinecone', async () => {
    // Record a successful outcome
    const updated = await recordEventOutcome({
      eventId: testEventId,
      outcome: 'success',
      outcomeDelay: 30,
      userRating: 5,
    })

    expect(updated).toBeDefined()
    expect(updated.outcome).toBe('success')
    expect(updated.outcomeDelay).toBe(30)
    expect(updated.userRating).toBe(5)

    // Verify profile was updated
    const profile = await db.userAIProfile.findUnique({
      where: { userId: testUserId },
    })

    expect(profile).toBeDefined()
    expect(profile?.successfulPredictions).toBeGreaterThan(0)
  })
})
