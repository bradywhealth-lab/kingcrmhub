# Cron Job Setup

## CRON_SECRET Generation

Generate a secure cron secret:

```bash
openssl rand -base64 32
```

Add the output to your environment variables:

```bash
CRON_SECRET=<generated-secret>
```

## Vercel Cron Configuration

The cron job is configured in `vercel.json`:

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

This runs weekly on Sunday at 2 AM UTC.

## Manual Trigger

To manually trigger the pattern extraction:

```bash
curl -X POST https://your-domain.com/api/cron/extract-patterns \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
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

## Troubleshooting

### Cron Job Not Running

1. Check Vercel deployment logs
2. Verify `CRON_SECRET` is set in environment variables
3. Check that the path matches your deployed route

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
