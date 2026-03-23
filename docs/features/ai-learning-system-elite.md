# AI Learning System - Maximum Elite

## Overview

The AI Learning System tracks every AI interaction, learns from successful outcomes, and personalizes future content generation based on each user's patterns.

## Features

### 1. Event Tracking

**Endpoint**: `POST /api/ai/track`

**Purpose**: Records all AI interactions with full context

**Includes**:
- Input/output data
- Embedding vectors (1536 dimensions via OpenAI)
- Event metadata (type, entity, profession, source)
- Timestamp for temporal analysis

**Example**:
```typescript
const result = await fetch('/api/ai/track', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    eventType: 'sms_sent',
    entityType: 'lead',
    entityId: 'lead-123',
    input: { message: 'Hello!' },
    output: { sent: true }
  })
})
```

### 2. User Feedback

**Endpoint**: `POST /api/ai/feedback`

**Purpose**: Records outcomes and user corrections

**Impact**: Directly improves future personalization

**Rating System**:
- 4-5 stars: Success outcome
- 1-2 stars: Failure outcome
- 3 stars: Pending outcome

### 3. Personalized Generation

**Endpoint**: `POST /api/ai/generate/personalized`

**Purpose**: RAG-based content generation using learned patterns

**Retrieves**: Similar past events via vector search

**Flow**:
1. Generate embedding for current context
2. Search Pinecone for similar events
3. Retrieve successful outputs from similar contexts
4. Generate personalized content based on patterns

### 4. Admin Insights

**Endpoint**: `GET /api/ai/admin/insights`

**Purpose**: System-wide learning metrics

**Requires**: Admin or owner role

**Dashboard**: `/admin/ai-insights`

**Metrics**:
- Total user profiles with learning data
- Total AI interactions tracked
- Success rate percentage
- Top performing event types
- Scraping source performance

### 5. Weekly Pattern Extraction

**Endpoint**: `POST /api/cron/extract-patterns`

**Schedule**: Weekly (Sunday 2 AM UTC)

**Purpose**: Extract and store successful patterns

**Extracts**:
- Email templates (last 50)
- SMS templates (last 50)
- Industry knowledge (success rates by profession)
- Successful sources (lead source performance)

### 6. Scraping Performance

**Endpoint**: `GET /api/scraping/performance`

**Purpose**: Track lead source quality and conversion

**Returns**:
- Source domain
- Leads created
- Conversion rate

## Architecture

```
┌─────────────┐
│   OpenAI    │
│  Embeddings │
└──────┬──────┘
       │ 1536-dim vectors
       ▼
┌─────────────┐
│  Pinecone   │
│ Vector DB   │
└──────┬──────┘
       │ Semantic search
       ▼
┌─────────────┐
│  RAG Retrieval│
└──────┬──────┘
       │ Context + patterns
       ▼
┌─────────────┐
│ Personalized │
│  Generation  │
└─────────────┘
```

### Fallback Behavior

- **OpenAI unavailable**: Hash-based embeddings (consistent but not semantic)
- **Pinecone unavailable**: PostgreSQL similarity search (slower but functional)
- **Graceful degradation**: System continues working even if services are down

## Configuration

### Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=...
PINECONE_INDEX=kingcrm-ai-events
CRON_SECRET=...

# Optional
EMBEDDING_MODEL=text-embedding-3-small
USE_PINECONE_FOR_RAG=true
ASYNC_PINECONE_SYNC=true
EMBEDDING_CACHE_ENABLED=true
EMBEDDING_FALLBACK_ENABLED=true
PINECONE_BATCH_SIZE=100
```

## API Usage Examples

### Track an Event

```typescript
const result = await fetch('/api/ai/track', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    eventType: 'email_sent',
    entityType: 'lead',
    entityId: 'lead-123',
    input: { leadName: 'John', profession: 'Contractor' },
    output: { content: 'Hi John, ready to start your project?' }
  })
})
```

### Submit Feedback

```typescript
const result = await fetch('/api/ai/feedback', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entityType: 'lead',
    entityId: 'lead-123',
    eventId: 'event-abc',
    rating: 5,
    feedback: 'Great response!'
  })
})
```

### Generate Personalized Content

```typescript
const result = await fetch('/api/ai/generate/personalized', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contentType: 'sms',
    context: {
      leadName: 'John',
      profession: 'Contractor'
    }
  })
})
```

## Monitoring

### Key Metrics to Track

- Total interactions per user
- Success rate by event type
- Pinecone query performance
- Embedding API costs
- Pattern extraction success rate

### Admin Dashboard

Visit `/admin/ai-insights` for:
- Overview metrics
- Learning trends
- Top performing patterns
- Scraping performance

## Troubleshooting

### Pinecone Sync Fails

**Symptoms**: Events not syncing to Pinecone

**Solutions**:
1. Check `PINECONE_API_KEY` is set and valid
2. Verify index exists in Pinecone console
3. Check index has 1536 dimensions
4. Review logs for specific error messages

### Embeddings Not Generating

**Symptoms**: Hash fallback being used

**Solutions**:
1. Verify `OPENAI_API_KEY` is valid
2. Check OpenAI API quota not exceeded
3. Ensure fallback is enabled: `EMBEDDING_FALLBACK_ENABLED=true`

### Cron Job Not Running

**Symptoms**: Patterns not being extracted

**Solutions**:
1. Check `CRON_SECRET` matches between env and Vercel
2. Verify Vercel cron is configured in `vercel.json`
3. Check deployment logs for errors

### Poor Personalization Quality

**Symptoms**: Generated content doesn't match user patterns

**Solutions**:
1. Ensure sufficient successful events exist (need 20+)
2. Check Pinecone search is returning results
3. Verify event outcomes are being tracked correctly
4. Review pattern extraction logs

## Cost Estimates

### OpenAI Embeddings

| Metric | Value |
|--------|-------|
| Model | text-embedding-3-small |
| Cost | $0.02 / 1M tokens |
| Est. per 10K events | ~$0.04 |

### Pinecone

| Plan | Vectors | Price |
|------|---------|-------|
| Starter | 100K | ~$70/month |
| Production | 1M | ~$280/month |

## Support

- **OpenAI**: https://platform.openai.com/docs
- **Pinecone**: https://docs.pinecone.io
- **Rollback**: See `docs/rollback/ai-learning-elite.md`
