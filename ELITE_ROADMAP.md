# Elite CRM — Elite-Level Feature Roadmap

This document defines the **six elite pillars** and implementation plan so the CRM delivers a **$500K feel** with functionality at the forefront: texting, follow-ups, AI learning, appointment setting, lead scraping, and fully automated social + marketing.

---

## 1. Texting (SMS/MMS) — ELITE LEVEL

**Goal:** Two-way SMS/MMS at scale with templates, delivery status, and compliance.

| Capability | Elite standard |
|------------|----------------|
| **Outbound** | Send from CRM to lead phone; template variables (name, company); bulk send with rate limiting |
| **Inbound** | Receive replies; thread in MessageThread/Message; link to lead by phone |
| **Templates** | Template model (type: sms); variables; AI-suggested replies (Message.aiSuggestedReply) |
| **Delivery** | Status: pending → sent → delivered → read (Twilio webhooks); show in UI |
| **Compliance** | Opt-out handling; log consent; do-not-contact list |

**Implementation:**

- **Settings → Integrations:** Twilio Connect (Account SID, Auth Token, From number). Store in `Integration` (type: `twilio`).
- **API:** `POST /api/sms/send` (leadId, templateId or body, optional media). Create `Message` + `MessageThread`; call Twilio; store outbound message; return message id.
- **Webhook:** `POST /api/webhooks/twilio` — status callbacks + inbound SMS. Create/update Message; update thread; optionally create Activity.
- **UI:** Lead detail: “Send SMS” with template picker and thread view. Global “Messages” or inbox view for SMS threads.
- **Templates:** Use existing `Template` (type: `sms`). Add UI in Settings or Leads to manage SMS templates.

**Schema:** Already have `MessageThread`, `Message` (channel: sms), `Template` (type: sms). Optional: `LeadConsent` or flag on Lead for SMS opt-in.

---

## 2. Follow-Ups — ELITE LEVEL

**Goal:** Automated and manual follow-ups with rules, reminders, and AI-suggested next steps.

| Capability | Elite standard |
|------------|----------------|
| **Sequences** | Multi-step (email + SMS + task + delay); enroll by list or trigger; pause/skip/complete |
| **Rules** | “If no reply in 3 days → send follow-up”; “If lead scored &gt;80 → enroll in hot sequence” |
| **Reminders** | User-level “Follow up with X” at date/time; show in dashboard and sidebar |
| **AI** | “Suggested next step” per lead (use Lead.aiNextAction); learn from outcomes (won/lost) |

**Implementation:**

- **Sequence UI:** Already have Sequence, SequenceStep, SequenceEnrollment. Add: sequence builder (steps with delay + type + content), enroll leads (single or bulk), view enrollments and current step.
- **API:** `GET/POST /api/sequences`, `POST /api/sequences/[id]/enroll`, `GET /api/sequences/enrollments`. Execute steps via cron or queue (e.g. Vercel Cron, Inngest): send email/SMS at `nextStepAt`.
- **Automation:** Use `Automation` (trigger: lead_created, lead_scored, stage_changed). Actions: enroll_in_sequence, send_sms, create_task. Run in same cron or queue.
- **Reminders:** Add `FollowUp` or use Activity (type: task) with dueAt. Dashboard widget “Due today”; API `GET /api/activities?type=task&dueToday=true`.
- **AI:** Persist aiNextAction on Lead (already in schema). Ingest outcomes: when deal won/lost, send to AIFeedback or update PredictiveModel so scoring improves.

---

## 3. AI Learning — ELITE LEVEL

**Goal:** Scoring and next actions that improve from your data and feedback.

| Capability | Elite standard |
|------------|----------------|
| **Scoring** | Per-org model or rules; use email/company/title/source/engagement; re-score on activity |
| **Next action** | One clear recommendation per lead; consider stage, score, last contact |
| **Learning** | Feedback loop: user marks “good/bad” or deal outcome; tune weights or fine-tune |
| **Insights** | Real AIInsight records: “3 leads cold 7+ days”, “Deal at risk”, “Revenue forecast” |

**Implementation:**

- **Scoring:** Extend `calculateLeadScore` in upload route or move to `GET /api/ai/score?leadId=`. Input: lead fields + recent activities. Output: aiScore, aiNextAction, aiInsights. Option: call OpenAI/Anthropic for richer reasoning.
- **AI endpoint:** `POST /api/ai/insights` — batch job that computes insights (e.g. cold leads, at-risk deals) and creates/updates `AIInsight` rows. Run on schedule.
- **Feedback:** `POST /api/ai/feedback` — body: entityType, entityId, rating, corrections. Store in `AIFeedback`. Use in retraining or rule tweaks.
- **PredictiveModel:** Use `PredictiveModel` for win probability, expected value. Train periodically from historical pipeline + outcomes.

---

## 4. Appointment Setting — ELITE LEVEL

**Goal:** Book meetings with leads without back-and-forth; sync with calendar and send reminders.

| Capability | Elite standard |
|------------|----------------|
| **Booking link** | Public page or Calendly-style: pick slot → confirm → create Lead + Activity + calendar event |
| **Calendar sync** | Integration (Google Calendar, Outlook); show availability; write back event to calendar |
| **Reminders** | Email/SMS before meeting (e.g. 24h, 1h); use Sequence or one-off job |
| **CRM** | New lead from booking; link event to lead; pipeline stage “Meeting scheduled” |

**Implementation:**

- **Schema:** Add `Appointment` or use Activity (type: meeting) with start/end, externalEventId, calendarId. Or add `BookingPage` (org, slug, duration, buffer, timezone).
- **Integration:** `Integration` type `google_calendar` (or `outlook`). OAuth flow; store tokens; fetch free/busy and create events.
- **API:** `GET /api/calendar/availability?from=&to=` (from connected calendar). `POST /api/bookings` — create lead if new, create Activity (meeting), create calendar event, optionally enroll in reminder sequence.
- **Public page:** Route like `/book/[slug]` — show calendar grid, on select POST to `/api/bookings`, confirm page.
- **Reminders:** Cron: find meetings in next 24h/1h, send SMS/email via Template.

---

## 5. Scraping Leads (Websites / Directories) — ELITE LEVEL

**Goal:** Discover and import leads from websites and directories with dedup and AI enrichment.

| Capability | Elite standard |
|------------|----------------|
| **Targets** | URLs (list or sitemap); directory pages (e.g. industry listings); configurable selectors |
| **Extraction** | Names, emails, phones, companies, titles; store raw + normalized |
| **Dedup** | Match by email/phone to existing Lead; skip or merge |
| **Enrichment** | Optional AI pass: score, company info, suggested tags |
| **Compliance** | Respect robots.txt; rate limit; log source URL; GDPR-friendly (legitimate interest / consent where required) |

**Implementation:**

- **Schema:** Add `ScrapeJob` (organizationId, sourceUrl, type: directory|website, status, config JSON, startedAt, completedAt, stats). Add `ScrapedContact` (jobId, rawData JSON, normalized email/phone/name/company, leadId if merged).
- **API:** `POST /api/scrape` — body: url(s), type, options (selectors, maxPages). Create ScrapeJob; run in background (queue or serverless). `GET /api/scrape?jobId=` — status + results.
- **Worker:** Parse HTML (cheerio or similar); extract by selector or heuristics (mailto:, phone patterns, names); normalize; dedup against Lead; create Lead + optional Activity “Imported from [url]”.
- **UI:** “Leads” or “Import” tab: “Scrape from URL / Directory”. Form: URL, type, run → show job status and imported count. List of ScrapeJobs with status and “View leads”.

---

## 6. Fully Automated Social Media & Marketing — ELITE LEVEL

**Goal:** Create, schedule, and publish content across channels; performance and AI-assisted creation.

| Capability | Elite standard |
|------------|----------------|
| **Content queue** | ContentQueue per platform (linkedin, twitter, facebook, instagram); status: draft → scheduled → published |
| **Scheduling** | Publish at scheduled time (cron); optional time-slot suggestions by AI |
| **Creation** | AI-generated copy (and optionally images) from prompt or template; variables per campaign |
| **Channels** | Integrations per platform (tokens in Integration or SocialAccount); post via APIs |
| **Analytics** | Store metrics (impressions, clicks, etc.) in Campaign.metrics or ContentQueue; show in dashboard |

**Implementation:**

- **Schema:** Already have `ContentQueue`, `Campaign`, `SocialAccount`. Add scheduledAt, publishedAt, externalId, metrics to ContentQueue if missing.
- **API:** `GET/POST /api/content` — list/create ContentQueue items. `POST /api/content/[id]/schedule` — set scheduledAt. `GET /api/campaigns` and metrics.
- **AI:** `POST /api/ai/generate-content` — prompt + platform + tone → generate copy; optionally suggest image prompt. Save as draft in ContentQueue.
- **Publishing:** Cron: select ContentQueue where status = scheduled and scheduledAt &lt;= now; call platform API (LinkedIn, Twitter, etc.); update status and publishedAt; store post id in externalId.
- **UI:** “Social” or “Marketing” view: calendar of scheduled posts; composer (text + AI generate); connect accounts in Settings; campaign list with metrics.

---

## Priority Order (Suggested)

1. **Handoff done:** Refresh keys, real UploadsView, debug removed. ✅  
2. **Follow-ups + Texting:** Sequences and SMS share Message/Thread; Twilio + sequence execution unblock both.  
3. **AI learning:** Real scoring and insights API; then feedback loop.  
4. **Appointment setting:** Booking page + calendar sync for high perceived value.  
5. **Lead scraping:** New pipeline for lead acquisition.  
6. **Social + marketing:** Content queue + scheduling + AI generation.

---

## Key Files to Create/Extend

| Area | API routes | UI / Lib |
|------|------------|----------|
| Texting | `api/sms/send/route.ts`, `api/webhooks/twilio/route.ts` | Lead SMS composer; Messages inbox |
| Follow-ups | `api/sequences/route.ts`, `api/sequences/[id]/enroll/route.ts` | Sequence builder; Enrollments list; Automation rules |
| AI | `api/ai/score/route.ts`, `api/ai/insights/route.ts`, `api/ai/feedback/route.ts` | Insights panel; Feedback buttons |
| Appointments | `api/calendar/availability/route.ts`, `api/bookings/route.ts` | `/book/[slug]` page; Calendar in Settings |
| Scraping | `api/scrape/route.ts`, worker or serverless job | Import → “Scrape URL” form; Job status |
| Social | `api/content/route.ts`, `api/ai/generate-content/route.ts` | Social calendar; Composer; Campaign metrics |

---

## Session Handoff Note

- **Completed this session:** Refresh keys after CSV upload; UploadsView loads real data from GET /api/upload; debug instrumentation removed; this ELITE_ROADMAP.md added.
- **Next:** Implement Twilio send + webhook and Sequence execution (follow-ups + texting), then AI scoring/insights and appointment booking.
