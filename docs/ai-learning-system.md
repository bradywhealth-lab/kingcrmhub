# AI Personalized Learning System

## Overview

The AI Personalized Learning System is a comprehensive machine learning framework that continuously improves communication and decision-making by learning from every user interaction. It combines event capture, outcome tracking, pattern extraction, and semantic retrieval to deliver increasingly personalized AI-generated content.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Event Capture Layer                           │
│  All AI interactions (SMS, email, scoring, playbooks) are logged   │
│  with input, output, context, and optional lead profession          │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Feedback Loop                                   │
│  User feedback (ratings 1-5) and outcomes (success/failure)       │
│  are linked back to learning events for supervised learning          │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Pattern Extraction (Weekly)                        │
│  - Extract successful SMS/email templates                          │
│  - Calculate profession-specific success rates                     │
│  - Update UserAIProfile with learned patterns                      │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│               Personalized Generation with RAG                       │
│  - Retrieve similar past events using embedding similarity          │
│  - Get successful patterns for the task type                        │
│  - Apply profession-specific insights                               │
│  - Generate content matching user's proven style                   │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Models

### UserAIProfile
Stores learned patterns for each user:
- **Writing patterns**: Successful SMS/email templates
- **Industry knowledge**: Success rates by profession
- **Carrier preferences**: Top performing carriers
- **Successful sources**: Best scraping sources
- **Performance metrics**: Total interactions, successful predictions

### UserLearningEvent
Individual AI interaction records:
- **Event type**: sms_sent, email_sent, lead_scored, playbook_generated, etc.
- **Input/Output**: Full context of the interaction
- **Outcome**: success, failure, or pending
- **User feedback**: Rating and corrections
- **Embedding**: 1536-dim vector for semantic similarity search

### ScrapingSourcePerformance
Tracks scraping source effectiveness:
- **Conversion rates**: Leads created vs. converted
- **Common professions**: Types of contacts found
- **Performance trends**: Weekly/monthly statistics

## API Endpoints

### Event Tracking

**POST /api/ai/track**
- Tracks AI interactions for learning
- Creates UserAIProfile if needed
- Generates and stores embedding for semantic search

```typescript
await fetch('/api/ai/track', {
  method: 'POST',
  body: JSON.stringify({
    eventType: 'sms_sent',
    entityType: 'lead',
    entityId: 'lead-123',
    input: { template: 'follow-up-1' },
    output: { smsText: 'Hey, just checking in...' },
    leadProfession: 'Construction',
  }),
})
```

### Feedback Loop

**POST /api/ai/feedback**
- Submit user feedback (rating -1 to 5)
- Optionally link to a learning event via `eventId`
- Automatically records outcome on linked event

```typescript
await fetch('/api/ai/feedback', {
  method: 'POST',
  body: JSON.stringify({
    eventId: 'event-abc123', // Links to learning event
    entityType: 'sms_sent',
    entityId: 'lead-123',
    rating: 5,
    feedback: 'Lead replied positively!',
  }),
})
```

### Profile & Insights

**GET /api/ai/profile**
- Retrieve user's learned profile
- Returns successful patterns, industry knowledge, success metrics

**GET /api/ai/reports/weekly**
- Weekly learning report for the user
- Top event types, success rate, successful predictions

**GET /api/ai/reports/monthly**
- Monthly scraping performance report
- Top sources by conversion rate

### Personalized Generation

**POST /api/ai/generate/personalized**
- Generate AI content using learned patterns
- RAG retrieval includes similar past events and successful templates
- Profession-specific personalization when available

```typescript
await fetch('/api/ai/generate/personalized', {
  method: 'POST',
  body: JSON.stringify({
    task: 'sms',
    context: {
      leadName: 'John',
      company: 'ABC Construction',
    },
    leadProfession: 'Construction',
  }),
})
```

### Admin & Internal

**POST /api/ai/internal/extract-patterns**
- Called by cron job weekly
- Extracts patterns from past 7 days of interactions
- Updates UserAIProfile with new learnings

**GET /api/ai/admin/insights**
- Admin-only endpoint for system-wide learning metrics
- Per-user statistics, active learners, success rates

**GET /api/scraping/performance**
- Scraping source performance for organization
- Top sources by conversion rate

## Usage Examples

### Complete Learning Flow

```typescript
// 1. Track when AI generates an SMS
const event = await trackAIEvent({
  userId: 'user-123',
  organizationId: 'org-456',
  eventType: 'sms_sent',
  entityType: 'lead',
  entityId: 'lead-789',
  input: { template: 'follow-up-2', leadName: 'Jane' },
  output: { smsText: 'Hi Jane, following up on our conversation...' },
  leadProfession: 'Healthcare',
})

// 2. Later, when lead responds positively
await recordEventOutcome({
  eventId: event.id,
  outcome: 'success',
  userRating: 5,
})

// 3. Weekly cron extracts patterns and updates profile
// Patterns are now available for personalized generation

// 4. Generate new SMS using learned patterns
const response = await fetch('/api/ai/generate/personalized', {
  method: 'POST',
  body: JSON.stringify({
    task: 'sms',
    context: { leadName: 'John', company: 'MediCare Clinic' },
    leadProfession: 'Healthcare',
  }),
})
const { result } = await response.json()
// Result will incorporate successful Healthcare patterns from step 2
```

## Embedding System

The system uses 1536-dimensional embeddings for semantic similarity:

- **MVP**: Hash-based embeddings (no external API required)
- **Production**: Replace with OpenAI embeddings or similar

Embeddings enable:
- Finding similar past interactions
- RAG-based generation
- Semantic search across user history

## Performance Tracking

Scraping performance is tracked per source domain:

- **totalScraped**: Pages scraped from source
- **leadsCreated**: Leads generated from source
- **leadsConverted**: Leads that became customers
- **conversionRate**: leadsCreated / leadsConverted
- **avgLeadScore**: Average quality of leads from source
- **commonProfessions**: Industries most found at source

This enables intelligent source prioritization and budget allocation.

## Cron Jobs

Recommended schedule:

- **Weekly**: `POST /api/ai/internal/extract-patterns`
  - Extract patterns from past 7 days
  - Update user profiles with new learnings

- **Monthly**: Review `/api/scraping/performance`
  - Identify top/bottom performing sources
  - Adjust scraping strategy accordingly

## Privacy & Data

- Each user's profile is isolated to their organization
- Embeddings are stored in the UserLearningEvent table
- Feedback is optionally linked to events for learning
- Admin endpoints should be protected by role checks

## Future Enhancements

1. **OpenAI Embeddings**: Replace hash-based with semantic embeddings
2. **Vector Database**: Use pgvector for faster similarity search
3. **A/B Testing**: Test personalized vs. generic content
4. **Multi-armed Bandit**: Balance exploration vs. exploitation
5. **Cross-user Learning**: Share patterns across similar organizations
6. **Real-time Updates**: Stream pattern updates via webhooks

## Monitoring

Key metrics to track:

- **Success Rate**: (successful predictions) / (total interactions)
- **Active Learners**: Users with >10 tracked interactions
- **Pattern Coverage**: Users with learned patterns for each task type
- **RAG Hit Rate**: How often similar events are found
- **Generation Quality**: User ratings on personalized content

Monitor these via `/api/ai/admin/insights` and the weekly/monthly reports.
