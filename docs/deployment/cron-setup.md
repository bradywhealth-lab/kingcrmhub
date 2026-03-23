# Cron Job Setup

This guide explains how to configure and secure the cron job endpoints for the AI Learning System's weekly pattern extraction feature.

## CRON_SECRET Generation

The cron endpoint requires a secret token for authentication to prevent unauthorized access. Generate a secure secret using OpenSSL:

```bash
openssl rand -base64 32
```

Example output (for reference only - **generate your own**):
```
pPT32u1/wN8tkz3LAGHnRgPKuVHPDsKVcC+T6fDTKoc=
```

## Setting the Environment Variable

Add the generated secret to your environment variables:

### Vercel (Production)

1. Go to your project settings in Vercel dashboard
2. Navigate to **Environment Variables**
3. Add a new variable:
   - **Key**: `CRON_SECRET`
   - **Value**: Your generated secret
   - **Environments**: Production, Preview, Development (as needed)

### Local Development

Add to your `.env.local` file:

```env
CRON_SECRET=your_generated_secret_here
```

**IMPORTANT**: Never commit `.env.local` files or expose secrets in version control.

## Vercel Cron Configuration

The cron job is configured in `vercel.json` at the project root:

```json
{
  "crons": [
    {
      "path": "/api/cron/extract-patterns",
      "schedule": "0 2 * * 0"
    }
  ]
}
```

**Schedule Breakdown:**
- `0 2 * * 0` = Every Sunday at 2:00 AM UTC
  - Minute: 0
  - Hour: 2
  - Day of month: *
  - Month: *
  - Day of week: 0 (Sunday)

**What it does:**
- Triggers `/api/cron/extract-patterns` weekly
- Extracts user behavior patterns from the past 7 days
- Updates pattern-based AI insights

## Manual Trigger

For testing or immediate execution, you can manually trigger the cron endpoint:

### Using curl

```bash
curl -X POST https://your-domain.com/api/cron/extract-patterns \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

### Using the Vercel CLI

```bash
vercel env pull .env.local
curl -X POST http://localhost:3000/api/cron/extract-patterns \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "Content-Type: application/json"
```

## What the Cron Job Does

1. Fetches all successful AI learning events from the past 7 days
2. Groups events by user
3. Extracts patterns from successful outputs:
   - Email templates (last 50)
   - SMS templates (last 50)
   - Industry knowledge (attempts/successes by profession)
   - Successful sources (lead source performance)
4. Updates user profiles with learned patterns

## Security Considerations

1. **Never expose CRON_SECRET** in client-side code or public repositories
2. **Use strong secrets** - always generate new secrets with `openssl rand -base64 32`
3. **Rotate periodically** - consider updating secrets on a regular schedule
4. **Monitor execution logs** - check Vercel logs for failed or unauthorized attempts

## Troubleshooting

### Cron Job Not Running

1. Check Vercel deployment logs for errors
2. Verify `vercel.json` is deployed with the project
3. Confirm CRON_SECRET is set in environment variables

### Authorization Failures

1. Verify CRON_SECRET matches between environment and request
2. Check the Authorization header format: `x-cron-secret: YOUR_SECRET`
3. Ensure the header is properly escaped in shell commands

### Pattern Extraction Fails

Check the cron job response:

```bash
curl -X POST https://your-domain.com/api/cron/extract-patterns \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -v
```

Expected response:

```json
{
  "success": true,
  "processed": {
    "usersUpdated": 5,
    "eventsAnalyzed": 42,
    "patternsExtracted": 15
  },
  "timestamp": "2026-03-21T02:00:00.000Z"
}
```

### Database Issues

The cron job requires:
- `UserLearningEvent` table with `outcome` field
- `UserAIProfile` table for storing learned patterns
- Proper foreign key relationships

Ensure migrations are applied:

```bash
npx prisma migrate deploy
```

## Related Files

- `/api/cron/extract-patterns/route.ts` - Cron endpoint implementation
- `vercel.json` - Cron job schedule configuration
- `/lib/rag-retrieval.ts` - RAG utilities for pattern extraction
