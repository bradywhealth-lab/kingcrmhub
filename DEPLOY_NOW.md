# DEPLOY NOW — Step by Step for BDUBB

## What to do RIGHT NOW (10 min total):

### Step 1: Disable Vercel Protection (2 min)

1. Go to: https://vercel.com/brighter-health/insurafuze-king-crm/settings/protection
2. Set: **"Deployment Protection" → Disabled**
3. Click: **Save**

### Step 2: Add Missing Env Vars to Vercel (5 min)

1. Go to: https://vercel.com/brighter-health/insurafuze-king-crm/settings/environment-variables
2. Add these (click "Add New" for each):

| Key | Value | Environment |
|-----|-------|-------------|
| `TWILIO_ACCOUNT_SID` | Your Twilio Account SID | Production |
| `TWILIO_AUTH_TOKEN` | Your Twilio Auth Token | Production |
| `TWILIO_FROM_NUMBER` | Your Twilio phone number (e.g. +15551234567) | Production |
| `APP_BASE_URL` | `https://insurafuze-king-crm.vercel.app` | Production |
| `DATABASE_URL` | Your existing database URL | Production |
| `NEXTAUTH_SECRET` | Your existing secret | Production |
| `NEXTAUTH_URL` | `https://insurafuze-king-crm.vercel.app` | Production |

**Note:** The app has graceful degradation, so it will work even without Twilio/Pinecone credentials. SMS and AI features will be disabled but won't crash the app.

3. Click **Save** for each variable.

### Step 3: Set Twilio Webhook (1 min) — ONLY if using Twilio

1. Go to Twilio Console → Phone Numbers → Your number
2. Find "Messaging" section → "A message comes in" webhook
3. Set to: `https://insurafuze-king-crm.vercel.app/api/webhooks/twilio`
4. Click **Save**

**Skip this step** if not using Twilio.

### Step 4: Deploy (30 seconds)

1. Go to: https://vercel.com/brighter-health/insurafuze-king-crm/deployments
2. Click **Redeploy** (or push any small change to trigger deploy)
3. Wait for build to complete (~2-3 min)

### Step 5: Verify Health (1 min)

Visit these URLs to verify everything is working:

1. **Health check:** https://insurafuze-king-crm.vercel.app/api/health
   - Should return: `{"status":"ok","timestamp":"...","version":"1.0.0"}`

2. **Ready check:** https://insurafuze-king-crm.vercel.app/api/ready
   - Should return: `{"ok":true,"ready":true,"database":"ok",...}`

3. **Auth page:** https://insurafuze-king-crm.vercel.app/auth
   - Should show login/signup page

### Step 6: Seed Demo Data (2 min) — OPTIONAL but recommended

After successful deploy, run the seed script to create a demo org and admin user:

```bash
# From your local machine
cd ~/Desktop/z.ai-1st-kingCRM
npx ts-node scripts/seed-demo-org.ts
```

**Demo credentials:**
- Email: `john@demo.com`
- Password: `changeme123`
- You'll be prompted to change password on first login

---

## What's Included in This Deploy

✅ All 87 tests passing
✅ Zero TypeScript errors
✅ Clean build
✅ Health and ready endpoints
✅ Graceful degradation for Twilio SMS (works without credentials)
✅ Graceful degradation for Pinecone AI (works without credentials)
✅ Demo data seed script

---

## Troubleshooting

**If deploy fails:**
- Check the build logs in Vercel
- Make sure all required env vars are set
- Verify DATABASE_URL is correct

**If auth page doesn't load:**
- Verify NEXTAUTH_URL and NEXTAUTH_SECRET are set
- Check browser console for errors

**If SMS doesn't work:**
- Verify TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER are set
- Check Twilio webhook URL is correct

---

## After First Login

1. **Change your password** (you'll be prompted)
2. **Go to Settings** to configure:
   - Your organization details
   - Twilio integration (for SMS)
   - AI preferences (for Pinecone)
3. **Import leads** or create them manually

---

## Need Help?

Check these logs:
- Vercel deployment logs
- `/api/health` endpoint response
- Browser console for client errors

**Created:** March 24, 2026
**Version:** 1.0.0
