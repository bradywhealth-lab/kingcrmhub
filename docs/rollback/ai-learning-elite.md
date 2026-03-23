# AI Learning System - Maximum Elite Rollback Plan

## Scenarios and Rollback Steps

### Scenario 1: Pinecone Integration Issues

**Symptoms**:
- Event tracking failing
- High latency on event creation
- Pinecone API errors in logs

**Rollback**:
1. Set environment variable: `USE_PINECONE_FOR_RAG=false`
2. Set environment variable: `ASYNC_PINECONE_SYNC=false`
3. Redeploy application
4. System will use PostgreSQL similarity search

**Verification**:
```bash
curl https://your-app.com/api/ai/track -d '{}' \
  -H "Content-Type: application/json"
# Should succeed without Pinecone
```

### Scenario 2: OpenAI Embedding Issues

**Symptoms**:
- Embedding generation failing
- OpenAI quota exceeded
- API key invalid

**Rollback**:
1. Set environment variable: `EMBEDDING_FALLBACK_ENABLED=true`
2. Or remove `OPENAI_API_KEY` from environment
3. System will use hash-based embeddings

**Note**: Hash-based embeddings provide consistency but not semantic similarity.

### Scenario 3: Cron Job Failures

**Symptoms**:
- Weekly pattern extraction not running
- Vercel cron errors

**Rollback**:
1. Remove `vercel.json` cron configuration
2. Manually trigger patterns:
```bash
curl -X POST https://your-app.com/api/cron/extract-patterns \
  -H "x-cron-secret: YOUR_SECRET"
```

### Scenario 4: Database Migration Issues

**Symptoms**:
- Schema errors
- pineconeId column issues

**Rollback**:
```bash
# Rollback migration
npx prisma migrate resolve --rolled-back add_pinecone_id

# Or manually remove column
npx prisma db execute --stdin
ALTER TABLE "UserLearningEvent" DROP COLUMN "pineconeId";
```

### Scenario 5: Full System Rollback

**To revert all Maximum Elite features**:

1. **Revert to commit before elite implementation**:
```bash
git log --oneline | grep "feat: add"
# Find the commit before elite work started
git revert <commit-range>
```

2. **Remove environment variables**:
```bash
unset OPENAI_API_KEY
unset PINECONE_API_KEY
unset CRON_SECRET
```

3. **Rollback database**:
```bash
npx prisma migrate resolve --rolled-back add_pinecone_id
```

4. **Redeploy**

## Data Preservation

### Before Rollback

1. **Export learning data**:
```bash
# Export all learning events
npx prisma db pull

# Backup your database
pg_dump $DATABASE_URL > backup.sql
```

2. **Export Pinecone data** (if available):
```bash
# Use Pinecone export or query all vectors
curl -X POST https://api.pinecone.io/indexes/kingcrm-ai-events/vectors/export \
  -H "Api-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}' > pinecone-backup.json
```

### After Rollback

1. **Verify core functionality**:
```bash
# Test event tracking
curl -X POST /api/ai/track -d '{"eventType":"test"}'

# Test profile retrieval
curl /api/ai/profile
```

2. **Monitor logs for errors**

## Partial Rollbacks

### Keep Embeddings, Remove Pinecone

If OpenAI embeddings work but Pinecone has issues:

1. Set: `USE_PINECONE_FOR_RAG=false`
2. Set: `ASYNC_PINECONE_SYNC=false`
3. Keep: `OPENAI_API_KEY`

Result: Semantic embeddings with PostgreSQL search

### Keep Pinecone, Remove Cron

If Pinecone works but cron fails:

1. Remove `vercel.json`
2. Manually run pattern extraction when needed

Result: Vector search without automated pattern updates

## Emergency Contacts

### Database Issues

- Check Prisma migration status: `npx prisma migrate status`
- Rollback: `npx prisma migrate resolve --rolled-back <migration>`
- Docs: https://www.prisma.io/docs/concepts/components/prisma-migrate

### Pinecone Issues

- Status: https://status.pinecone.io
- Docs: https://docs.pinecone.io
- Support: support@pinecone.io

### OpenAI Issues

- Status: https://status.openai.com
- Docs: https://platform.openai.com/docs
- Support: https://support.openai.com

## Recovery Procedures

### After Rollback, Re-enable Features

Once issues are resolved:

1. **Fix root cause** (API keys, configuration, etc.)
2. **Set environment variables** back to enabled state
3. **Redeploy application**
4. **Verify features work**:
```bash
# Test embedding generation
curl /api/ai/track -d '{"eventType":"test","input":{"test":"data"}}'

# Test Pinecone sync
# (Check logs for successful upsert)

# Test pattern extraction
curl -X POST /api/cron/extract-patterns \
  -H "x-cron-secret: YOUR_SECRET"
```

### Data Migration After Rollback

If data was lost during rollback:

1. **Restore database backup**:
```bash
psql $DATABASE_URL < backup.sql
```

2. **Re-sync Pinecone** (if using):
- Create script to re-index events from PostgreSQL
- Run in batches to avoid rate limits
- Monitor for errors

## Testing After Rollback

Verify system health:

```bash
# 1. Check tests pass
npm test

# 2. Check build succeeds
npm run build

# 3. Test core API endpoints
curl /api/health
curl /api/ai/profile
curl /api/leads

# 4. Check error logs
# (Vercel: deployment logs)
# (Local: console output)
```

## Known Issues and Workarounds

### Issue: Hash embeddings not semantically similar

**Cause**: Fallback to hash-based when OpenAI unavailable

**Workaround**: Enable OpenAI or accept reduced personalization quality

### Issue: Pinecone namespace not found

**Cause**: First upsert to new namespace

**Workaround**: Namespace created automatically on first write

### Issue: Cron job returns 401

**Cause**: CRON_SECRET mismatch

**Workaround**: Verify CRON_SECRET matches exactly in all environments

## Rollback Decision Tree

```
Issue Detected
    |
    v
Is it critical?
    |
    +-- No --> Log and monitor
    |
    +-- Yes --> Can it be fixed quickly?
                    |
                    +-- Yes --> Fix and redeploy
                    |
                    +-- No --> Which system is failing?
                                    |
                                    +-- OpenAI --> Disable embeddings (hash fallback)
                                    |
                                    +-- Pinecone --> Disable vector sync (PG fallback)
                                    |
                                    +-- Cron --> Manual pattern extraction
                                    |
                                    +-- Database --> Migration rollback
                                    |
                                    +-- Multiple --> Full system rollback
```

## Post-Rollback Checklist

- [ ] Core functionality verified
- [ ] Tests passing
- [ ] Build succeeds
- [ ] Error rates normal
- [ ] Performance acceptable
- [ ] Data integrity verified
- [ ] Documentation updated
- [ ] Team notified of rollback
- [ ] Root cause identified
- [ ] Fix plan documented
