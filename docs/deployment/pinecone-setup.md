# Pinecone Vector Database Setup

## Prerequisites

- Pinecone account (free tier available at [pinecone.io](https://www.pinecone.io/))
- Organization ID

## Create Index

1. Log in to [Pinecone Console](https://app.pinecone.io/)
2. Navigate to "Indexes" and click "Create Index"
3. Configure your index with these settings:
   - **Name**: `kingcrm-ai-events`
   - **Dimensions**: `1536` (for OpenAI text-embedding-3-small)
   - **Metric**: `cosine`
   - **Pod Type**: `p1.x1` (starter) or `s1.x1` (serverless)

## Environment Variables

Add to your environment (Vercel or local `.env`):

```bash
PINECONE_API_KEY=your-api-key-here
PINECONE_INDEX=kingcrm-ai-events
PINECONE_ENVIRONMENT=us-east-1-aws
```

### Finding Your API Key

1. Go to [Pinecone Console](https://app.pinecone.io/)
2. Click on "API Keys" in the left sidebar
3. Copy your API key

## Verification

Test the connection:

```bash
curl -X GET https://api.pinecone.io/indexes \
  -H "Api-Key: YOUR_PINECONE_API_KEY"
```

Expected response:

```json
{
  "indexes": [
    {
      "name": "kingcrm-ai-events",
      "dimension": 1536,
      "metric": "cosine",
      "status": "Ready"
    }
  ]
}
```

## Namespace Usage

The AI Learning System uses Pinecone namespaces for multi-tenancy:

- **Format**: `org-{organizationId}`
- **Purpose**: Isolate vectors by organization
- **Example**: `org-abc123` contains vectors for organization `abc123`

No manual namespace configuration needed - the system creates them automatically.

## Vector Schema

Each stored vector contains:

| Field | Description |
|-------|-------------|
| `id` | Unique event ID (format: `{orgId}_{eventId}`) |
| `values` | 1536-dimensional embedding vector |
| `metadata.userId` | User who created the event |
| `metadata.eventType` | Type of AI interaction (email_sent, sms_sent, etc.) |
| `metadata.entityType` | Type of entity (lead, contact, etc.) |
| `metadata.entityId` | ID of the related entity |
| `metadata.outcome` | Event outcome (success, failure, pending) |
| `metadata.createdAt` | ISO timestamp of event creation |

## Cost Estimates

| Plan | Vectors | Price |
|------|---------|-------|
| Starter | 100K | ~$70/month |
| Production | 1M | ~$280/month |

Each AI learning event stores one vector.

## Troubleshooting

### "Namespace not found" Error

Namespaces are created automatically when you first upsert vectors. If you see this error:

1. Check your index name matches `PINECONE_INDEX`
2. Verify your API key is correct
3. Check the Pinecone console for index status

### "Dimension mismatch" Error

If you see dimension errors:

1. Verify your index has 1536 dimensions
2. Check that `EMBEDDING_MODEL` is `text-embedding-3-small` (1536 dims)
3. If using a different model, recreate your index with correct dimensions

### Connection Timeouts

1. Check your network can reach `api.pinecone.io`
2. Verify your API key hasn't expired
3. Check Pinecone status page for outages

## Data Management

### Exporting Data

```bash
# Export all vectors from a namespace
curl -X POST https://api.pinecone.io/indexes/kingcrm-ai-events/vectors/export \
  -H "Api-Key: YOUR_PINECONE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"namespace": "org-abc123"}'
```

### Clearing a Namespace

```bash
# Delete all vectors in a namespace
curl -X POST https://api.pinecone.io/indexes/kingcrm-ai-events/vectors/delete \
  -H "Api-Key: YOUR_PINECONE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"deleteAll": true, "namespace": "org-abc123"}'
```

### Deleting the Index

**Warning**: This cannot be undone!

```bash
curl -X DELETE https://api.pinecone.io/indexes/kingcrm-ai-events \
  -H "Api-Key: YOUR_PINECONE_API_KEY"
```
