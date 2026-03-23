# Go-Live Tomorrow Checklist - UPDATED 2026-03-22

## ✅ CURRENT STATUS

**Build Status:** PASSING ✅
- TypeScript compilation: PASS
- Prisma generate: PASS
- All tests: 87 PASSING
- ESLint: PASS

**Features Completed:**
- ✅ AI Learning System (Tasks 10-20) - Complete with Pinecone, OpenAI embeddings, admin dashboard
- ✅ Twilio SMS Integration - Full send/receive, webhook handler, opt-out handling
- ✅ Lead Auto-Qualification - Auto-scoring on create and status change
- ✅ Sequence Runner with SMS support

## REQUIRED ENVIRONMENT VARIABLES

Set these in your hosting provider dashboard:

### Core Database & Auth
```
DATABASE_URL=                    # PostgreSQL connection string
INTERNAL_RUNNER_KEY=            # For automation runner security
APP_BASE_URL=                   # Your app URL
```

### Supabase Object Storage (for carrier documents)
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=         # e.g., "kingcrm-docs"
```

### AI Features (OpenAI + Pinecone)
```
OPENAI_API_KEY=                  # For AI embeddings and content generation
PINECONE_API_KEY=                # For vector search (optional)
PINECONE_INDEX=kingcrm-ai-events
USE_PINECONE_FOR_RAG=false       # Set to true when Pinecone is configured
ASYNC_PINECONE_SYNC=false       # Set to true for async sync
```

### Twilio SMS (THE MONEY MAKER) 🚀
```
TWILIO_ACCOUNT_SID=             # Your Twilio Account SID
TWILIO_AUTH_TOKEN=              # Your Twilio Auth Token
TWILIO_FROM_NUMBER=             # Your Twilio phone number (e.g., +1234567890)
```

### Optional Integrations
```
LINEAR_API_KEY=
SCRAPINGBEE_API_KEY=
FIRECRAWL_API_KEY=
```

### Cron Jobs
```
CRON_SECRET=                    # Generate with: openssl rand -base64 32
```

---

## PRE-DEPLOYMENT CHECKLIST

### 1) Database Migration
```bash
# Push schema to production
npx prisma db push --accept-data-loss
```

### 2) Verify Health Endpoints
```bash
curl https://your-app.com/api/health
curl https://your-app.com/api/ready
```
Both should return 200.

### 3) Test SMS Integration (Optional but Recommended)
1. Configure Twilio env vars
2. Send test SMS via API:
```bash
curl -X POST https://your-app.com/api/sms/send \
  -H "Content-Type: application/json" \
  -H "x-session-token: YOUR_SESSION_TOKEN" \
  -d '{"leadId": "LEAD_ID", "body": "Test message"}'
```

### 4) Configure Webhooks (Twilio)
Set your Twilio SMS webhook URL to:
```
https://your-app.com/api/webhooks/twilio
```

### 5) Schedule Automation Runner
Cron job running every 10 minutes:
```bash
curl -X POST https://your-app.com/api/sequences/run \
  -H "x-internal-runner-key: YOUR_INTERNAL_RUNNER_KEY"
```

### 6) Configure Weekly Pattern Extraction (Optional)
Your Vercel cron is already configured in `vercel.json`:
- Runs Sunday 2AM UTC
- Requires CRON_SECRET header

---

## PRODUCTION VERIFICATION

### Manual Smoke Test

1. **Create a lead:**
```bash
curl -X POST https://your-app.com/api/leads \
  -H "Content-Type: application/json" \
  -H "x-session-token: YOUR_SESSION_TOKEN" \
  -d '{"firstName": "Test", "lastName": "Lead", "email": "test@example.com", "phone": "+15551234567"}'
```
Expected: Lead created with aiScore calculated

2. **Check AI insights:**
```bash
curl https://your-app.com/api/ai/my-day \
  -H "x-session-token: YOUR_SESSION_TOKEN"
```
Expected: Daily assistant insights

3. **Verify admin dashboard:**
Visit `/admin/ai-insights` (requires admin/owner role)

---

## SECURITY NOTES

- ✅ All API routes have authentication checks
- ✅ Rate limiting implemented on mutating endpoints
- ✅ Runner endpoints require internal key
- ✅ Cron endpoint requires CRON_SECRET
- ✅ SMS opt-out handling implemented (STOP/UNSUBSCRIBE keywords)

---

## POST-DEPLOY TASKS

1. **Monitor logs** for any Twilio webhook issues
2. **Verify Pinecone setup** if using vector search (see docs/deployment/pinecone-setup.md)
3. **Generate CRON_SECRET** if not already set: `openssl rand -base64 32`
4. **Test sequence enrollment** with a real lead
5. **Verify SMS sequences** by enrolling a lead in an SMS sequence

---

## Rollback Plan

If issues arise:

1. **SMS Issues:** Remove Twilio env vars - system will gracefully degrade
2. **AI Issues:** Remove OPENAI_API_KEY - falls back to hash-based embeddings
3. **Pinecone Issues:** Set `USE_PINECONE_FOR_RAG=false`

See `docs/rollback/ai-learning-elite.md` for detailed rollback procedures.

---

## Success Metrics

| Metric | Status |
|--------|--------|
| Build | ✅ Passing |
| Tests | ✅ 87/87 passing |
| Lint | ✅ No errors |
| Type errors | ✅ 0 |
| API Routes | ✅ 30+ routes |
| Features | ✅ SMS, AI Scoring, Sequences, Scraping, Social, Carriers |

**READY TO DEPLOY** 🚀
