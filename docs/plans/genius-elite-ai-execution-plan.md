# GENIUS ELITE AI — Master Execution Plan

**Project:** kingCRM — AI Personalized Continuous Learning System
**Date:** March 20, 2026
**Status:** 2 of 23 tasks complete | Resume at Task 3
**Goal:** Build the smartest CRM AI that learns each user's style, tracks what works, and gets better over time — automatically.

---

## How This Plan Works (Simple Version)

Think of this system like a personal assistant that watches what you do, remembers what worked, and uses those wins to help you do better next time. Here's what it learns:

1. **Your writing style** — how you talk to leads in emails and texts
2. **What converts** — which messages, sources, and approaches actually close deals
3. **Industry patterns** — what works for doctors vs. contractors vs. realtors
4. **Source intelligence** — which scraping sites give you the best leads

The plan below breaks every remaining task into phases, and tells you exactly which AI agent, skill, or tool handles each piece — and why.

---

## PHASE 1: Core Infrastructure (Tasks 3–7)

> **What this does:** Builds the tracking engine. Every time the AI does something (scores a lead, writes an SMS, generates a playbook), it gets logged so the system can learn from it later.

### Task 3 — Create AI Tracking Utilities
| Detail | Value |
|--------|-------|
| **File** | `src/lib/ai-tracking.ts` |
| **Agent** | **Claude Code + Superpowers Subagent** |
| **Why** | Code is already written in the handoff doc. Subagent writes the file, runs TDD (write failing test → make it pass), self-reviews, then gets a 2-stage review (spec compliance + code quality). Fresh agent = no context bleed. |
| **Tools Used** | Bash (file creation, `npm test`), Vitest (unit tests), Git (commit) |
| **Commit** | `feat: add AI event tracking utilities` |

### Task 4 — Create AI Track API Endpoint
| Detail | Value |
|--------|-------|
| **Files** | `src/app/api/ai/track/route.ts`, `route.test.ts` |
| **Agent** | **Claude Code + Superpowers Subagent** |
| **Why** | Follows the exact same pattern as your existing AI routes (`withRequestOrgContext`, `enforceRateLimit`, `parseJsonBody` with Zod). Subagent copies the pattern, wires in `trackAIEvent()`, writes tests. |
| **Tools Used** | Bash, Vitest, Zod (validation), Git |
| **Commit** | `feat: add AI event tracking endpoint` |

### Task 5 — Enhance Feedback Endpoint
| Detail | Value |
|--------|-------|
| **File** | `src/app/api/ai/feedback/route.ts` (modify existing) |
| **Agent** | **Claude Code + Superpowers Subagent** |
| **Why** | This is an edit to an existing file — adds `eventId` parameter so feedback links back to the learning event that triggered it. Subagent reads the existing route, adds the new field + `recordEventOutcome()` call. |
| **Tools Used** | Edit tool, Vitest, Git |
| **Commit** | `feat: link feedback to learning events for outcomes` |

### Task 6 — Create AI Profile API Endpoint
| Detail | Value |
|--------|-------|
| **File** | `src/app/api/ai/profile/route.ts` |
| **Agent** | **Claude Code + Superpowers Subagent** |
| **Why** | GET endpoint to retrieve a user's learned profile (writing style, patterns, success rate). Standard route creation. |
| **Tools Used** | Bash, Vitest, Git |
| **Commit** | `feat: add AI profile endpoint` |

### Task 7 — Wire Tracking into All Existing AI Routes
| Detail | Value |
|--------|-------|
| **Files** | `route.ts`, `score/route.ts`, `my-day/route.ts`, `carrier-playbook/route.ts` |
| **Agent** | **Claude Code + Superpowers Subagent** |
| **Why** | This touches 4 existing files. Subagent adds `trackAIEvent().catch(console.error)` after each AI action — fire-and-forget so it never slows down the actual response. |
| **Risk** | Highest risk task in Phase 1 — modifying production routes. Full test suite run after. |
| **Tools Used** | Edit tool, Vitest (full suite), Git |
| **Commit** | `feat: add event tracking to all AI endpoints` |

**Phase 1 Checkpoint:** Run `npm test` across entire project. All existing tests must still pass.

---

## PHASE 2: Scraping & Analytics (Tasks 8–12)

> **What this does:** Tracks which websites give you the best leads. Weekly and monthly reports show you which sources are worth your time and which are garbage.

### Task 8 — Create Scraping Performance Tracker
| Detail | Value |
|--------|-------|
| **File** | `src/lib/scraping-tracker.ts` |
| **Agent** | **Claude Code + Superpowers Subagent** |
| **Why** | New utility file. Functions: `trackScrapingPerformance()`, `recordLeadConversion()`, `getScrapingPerformanceReport()`. Uses the `ScrapingSourcePerformance` Prisma model already in the schema. |
| **Tools Used** | Bash, Vitest, Prisma Client, Git |
| **Commit** | `feat: add scraping performance tracker` |

### Task 9 — Create Scraping Performance API
| Detail | Value |
|--------|-------|
| **File** | `src/app/api/scraping/performance/route.ts` |
| **Agent** | **Claude Code + Superpowers Subagent** |
| **Why** | GET endpoint returns metrics per scraping source (total scraped, leads created, conversion rate, avg score). Standard route following project patterns. |
| **Tools Used** | Bash, Vitest, Zod, Git |
| **Commit** | `feat: add scraping performance API endpoint` |

### Task 10 — Weekly & Monthly Report Endpoints
| Detail | Value |
|--------|-------|
| **Files** | `src/app/api/ai/reports/weekly/route.ts`, `monthly/route.ts` |
| **Agent** | **Claude Code + Superpowers Subagent** |
| **Why** | Two new routes. Weekly = user performance metrics (interactions, success rate, top patterns). Monthly = scraping source analysis (which sites converted, which didn't). |
| **Tools Used** | Bash, Vitest, date-fns (date math), Git |
| **Commit** | `feat: add weekly and monthly report endpoints` |

### Task 11 — Integrate Tracking into Scrape Flow
| Detail | Value |
|--------|-------|
| **File** | `src/app/api/scrape/route.ts` (modify existing) |
| **Agent** | **Claude Code + Superpowers Subagent** |
| **Why** | When a scrape completes, call `trackScrapingPerformance()` with the results. Fire-and-forget pattern (`.catch(console.error)`). |
| **Tools Used** | Edit tool, Vitest, Git |
| **Commit** | `feat: track scraping performance for learning` |

### Task 12 — Add Profession Tracking to Lead Creation
| Detail | Value |
|--------|-------|
| **File** | `src/app/api/leads/route.ts` (modify existing) |
| **Agent** | **Claude Code + Superpowers Subagent** |
| **Why** | When a lead is created, extract their profession from company name or title using keyword matching (e.g., "Dr." = healthcare, "Construction" = contractor). Stores in the `profession` field already added to the Lead model. |
| **Tools Used** | Edit tool, Vitest, Git |
| **Commit** | `feat: extract and store lead profession for targeting` |

**Phase 2 Checkpoint:** Run `npm test`. Verify scraping routes still work. Spot-check a few lead creation calls.

---

## PHASE 3: Learning & Personalization (Tasks 13–18)

> **What this does:** This is the brain. It extracts patterns from your history, stores them as searchable embeddings, and uses RAG (Retrieval-Augmented Generation) to pull up your best past work when generating new content.

### Task 13 — Pattern Extraction Job
| Detail | Value |
|--------|-------|
| **File** | `src/app/api/ai/internal/extract-patterns/route.ts` |
| **Agent** | **Claude Code + Superpowers Subagent** |
| **Why** | This is a cron-triggered POST endpoint. Looks at the last 7 days of learning events, finds what worked (high ratings, successful outcomes), and updates the UserAIProfile with learned patterns. |
| **AI Integration** | Uses `zaiChatJson()` to have AI analyze patterns and extract insights |
| **Tools Used** | Bash, Vitest, ZAI SDK, Prisma, Git |
| **Commit** | `feat: add pattern extraction job for learning` |

### Task 14 — Personalized AI Generation Endpoint
| Detail | Value |
|--------|-------|
| **File** | `src/app/api/ai/generate/personalized/route.ts` |
| **Agent** | **Claude Code + Superpowers Subagent** |
| **Why** | The payoff endpoint. Takes a task (write SMS, write email, generate playbook) and generates content using the user's learned patterns as context. The AI sees what worked before and writes in your voice. |
| **AI Integration** | `zaiChatJson()` with learned profile injected into system prompt |
| **Tools Used** | Bash, Vitest, ZAI SDK, Git |
| **Commit** | `feat: add personalized AI generation using learned patterns` |

### Task 15 — pgvector Embedding Generation
| Detail | Value |
|--------|-------|
| **File** | `src/lib/embeddings.ts` |
| **Agent** | **Claude Code + Superpowers Subagent** |
| **Why** | Creates embeddings (numerical representations of text) so the system can find "similar" past events. MVP uses hash-based 1536-dimension embeddings. Later can swap in OpenAI embeddings. |
| **Database** | pgvector (already enabled in Task 1) |
| **Tools Used** | Bash, Vitest, Git |
| **Commit** | `feat: add embedding generation utilities` |

### Task 16 — Store Embeddings with Events
| Detail | Value |
|--------|-------|
| **File** | `src/lib/ai-tracking.ts` (modify) |
| **Agent** | **Claude Code + Superpowers Subagent** |
| **Why** | Updates `trackAIEvent()` to also generate and store an embedding for each event. This makes every interaction searchable by meaning, not just keywords. |
| **Tools Used** | Edit tool, Vitest, Git |
| **Commit** | `feat: store embeddings with learning events` |

### Task 17 — RAG Retrieval for Similar Events
| Detail | Value |
|--------|-------|
| **File** | `src/lib/rag-retrieval.ts` |
| **Agent** | **Claude Code + Superpowers Subagent** |
| **Why** | Functions: `retrieveSimilarEvents()` and `getSuccessfulPatterns()`. Uses cosine similarity on pgvector embeddings to find past events most similar to the current situation. Think of it as: "Show me what worked last time I dealt with a lead like this." |
| **Database** | pgvector cosine similarity search |
| **Tools Used** | Bash, Vitest, Prisma raw SQL (for vector queries), Git |
| **Commit** | `feat: add RAG retrieval for similar events` |

### Task 18 — Integrate RAG into Personalized Generation
| Detail | Value |
|--------|-------|
| **File** | `src/app/api/ai/generate/personalized/route.ts` (modify) |
| **Agent** | **Claude Code + Superpowers Subagent** |
| **Why** | The final connection. When generating personalized content, first retrieve similar successful events via RAG, then inject them as examples into the AI prompt. Now the AI says: "Last time you messaged a contractor lead from this source, you used this approach and it converted." |
| **Tools Used** | Edit tool, Vitest, Git |
| **Commit** | `feat: integrate RAG retrieval into personalized generation` |

**Phase 3 Checkpoint:** This is the most critical phase. Full `npm test` + manual test of the personalized generation endpoint with sample data.

---

## PHASE 4: Polish & Production (Tasks 19–23)

> **What this does:** Locks everything down. Request context, admin dashboard, integration tests, documentation, and final verification.

### Task 19 — Request Context Helper
| Detail | Value |
|--------|-------|
| **File** | `src/lib/request-context.ts` (modify) |
| **Agent** | **Claude Code + Superpowers Subagent** |
| **Why** | Ensures `userId` is always available in the request context. Every tracking call needs this. Quick verification + fix if needed. |
| **Tools Used** | Edit tool, Vitest, Git |
| **Commit** | `feat: ensure userId available in request context` |

### Task 20 — Admin Learning Insights Dashboard API
| Detail | Value |
|--------|-------|
| **File** | `src/app/api/ai/admin/insights/route.ts` |
| **Agent** | **Claude Code + Superpowers Subagent** |
| **Why** | Admin-only endpoint to see all user AI profiles, learning statistics, and system health. Shows how much the system has learned. |
| **Tools Used** | Bash, Vitest, Git |
| **Commit** | `feat: add admin learning insights endpoint` |

### Task 21 — Integration Tests
| Detail | Value |
|--------|-------|
| **Files** | `track/integration.test.ts`, `profile/integration.test.ts` |
| **Agent** | **Claude Code + Superpowers Subagent** |
| **Why** | End-to-end tests that verify the full flow: create event → record outcome → check profile updated → verify patterns extracted. |
| **Tools Used** | Vitest, Prisma (test DB), Git |
| **Commit** | `test: add integration tests for AI learning` |

### Task 22 — Documentation
| Detail | Value |
|--------|-------|
| **File** | `docs/ai-learning-system.md` |
| **Agent** | **Claude Code + Superpowers Subagent** |
| **Skill** | **doc-coauthoring** — structured documentation workflow |
| **Why** | Complete system documentation: architecture overview, all API endpoints, usage examples, and how the learning pipeline works. |
| **Tools Used** | Write tool, Git |
| **Commit** | `docs: add AI learning system documentation` |

### Task 23 — Final Integration Test & Verification
| Detail | Value |
|--------|-------|
| **What** | Manual testing checklist + full test suite |
| **Agent** | **Claude Code + Superpowers Subagent** |
| **Why** | Curl commands to hit every endpoint, verify responses, check database state. Then `npm test` for the final green checkmark. |
| **Tools Used** | Bash (curl commands, npm test), Git |
| **Commit** | `feat: complete AI personalized learning system` |

**Phase 4 Checkpoint:** ALL tests green. Manual verification complete. Documentation reviewed.

---

## Agent & Tool Assignment Summary

### Primary Execution Engine

| Component | What It Is | Role |
|-----------|-----------|------|
| **Claude Code** | Terminal-based AI coding agent | Runs all 21 remaining tasks |
| **Superpowers Plugin** | Disciplined workflow framework | Enforces plan → TDD → subagent → review pipeline |
| **Subagent-Driven Development** | Fresh agent per task | Prevents context pollution between tasks |

### Per-Task Agent Workflow

```
For each of the 21 tasks:
┌─────────────────────────────────────────────────┐
│ 1. Dispatch fresh Superpowers subagent           │
│ 2. Subagent reads task spec from plan doc        │
│ 3. Writes failing test first (TDD)              │
│ 4. Implements minimal code to pass              │
│ 5. Self-reviews the work                        │
│ 6. Spec Compliance Reviewer checks              │
│    → Fix loop if issues found                   │
│ 7. Code Quality Reviewer checks                 │
│    → Fix loop if issues found                   │
│ 8. Commit with descriptive message              │
│ 9. Mark task complete → next task               │
└─────────────────────────────────────────────────┘
```

### Database & Infrastructure Tools

| Tool | Used For |
|------|----------|
| **Prisma ORM** | All database queries (UserAIProfile, UserLearningEvent, ScrapingSourcePerformance) |
| **pgvector** | Embedding storage + cosine similarity search (RAG retrieval) |
| **Supabase** | Production PostgreSQL hosting + connection pooling |
| **Vitest** | All unit tests and integration tests |
| **Zod** | Request validation on all API endpoints |

### AI/ML Stack

| Tool | Used For |
|------|----------|
| **ZAI SDK** (`zaiChatJson`) | Pattern extraction, personalized generation, content creation |
| **pgvector embeddings** | Semantic search for similar past events (RAG) |
| **Hash-based embeddings (MVP)** | Fast 1536-dimension vectors without external API calls |
| **OpenAI Embeddings (future)** | Upgrade path for higher-quality semantic search |

### Skills That Apply

| Skill | When Used |
|-------|-----------|
| **superpowers:write-plan** | Already done — plan exists |
| **superpowers:execute-plan** | Execute all 21 tasks with subagent discipline |
| **doc-coauthoring** | Task 22 — writing system documentation |

### MCP Connectors (Production Support)

| Connector | Role |
|-----------|------|
| **Supabase MCP** | Direct database queries, migration verification, table inspection |
| **Vercel MCP** | Deploy, check build logs, monitor runtime after deployment |
| **Google Calendar MCP** | Schedule the weekly pattern extraction cron job |

---

## Execution Order & Dependencies

```
PHASE 1: Core Infrastructure ─────────────────
  Task 3  → Task 4  → Task 5  → Task 6  → Task 7
  (lib)     (API)     (edit)     (API)     (edit×4)

  Dependencies: 3 must finish before 4,5,6,7
  Tasks 4,5,6 can run in PARALLEL after 3
  Task 7 depends on 3 being done

PHASE 2: Scraping & Analytics ────────────────
  Task 8  → Task 9  → Task 10  → Task 11  → Task 12
  (lib)     (API)     (API×2)    (edit)      (edit)

  Dependencies: 8 must finish before 9,11
  Tasks 10 and 12 are independent — can run in PARALLEL

PHASE 3: Learning & Personalization ──────────
  Task 13 → Task 14 → Task 15 → Task 16 → Task 17 → Task 18
  (cron)    (API)     (lib)     (edit)     (lib)     (edit)

  Dependencies: STRICT SEQUENCE
  15 → 16 → 17 → 18 is a chain (embeddings → store → retrieve → use)
  13 and 14 can start in PARALLEL with 15

PHASE 4: Polish & Production ─────────────────
  Task 19 → Task 20 → Task 21 → Task 22 → Task 23
  (edit)    (API)     (tests)   (docs)    (verify)

  Dependencies: 19 should go first (context fix)
  20, 21, 22 can run in PARALLEL
  23 must be LAST (final verification)
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Breaking existing AI routes (Task 7) | Full test suite before + after. Fire-and-forget pattern means tracking failures can't break responses. |
| pgvector performance at scale | Hash-based embeddings are fast. Index on embedding column. Future: move to Pinecone if needed. |
| Pattern extraction quality | Start simple (frequency counting), iterate. ZAI analyzes patterns — quality improves as data grows. |
| Scrape route slowdown (Task 11) | Async fire-and-forget. Tracking runs after response is sent. |
| Test database state contamination | Fresh subagent per task = clean context. Vitest handles test isolation. |

---

## Success Criteria

When all 23 tasks are done, the system will:

- [x] Track every AI interaction automatically
- [x] Record outcomes (did the lead respond? did they convert?)
- [x] Extract patterns weekly (what writing style works? which sources convert?)
- [x] Generate personalized content using your past successes
- [x] Report on scraping source performance (weekly + monthly)
- [x] Find similar past situations using RAG (semantic search)
- [x] Have full test coverage and documentation

**The end result:** Each user gets an AI that sounds like them, knows what works for their leads, and gets smarter every week.

---

## How to Start

In Claude Code terminal:

```bash
# 1. Read this plan
# 2. Load the execution framework
/superpowers:execute-plan

# 3. Point it at the implementation plan
docs/plans/2026-03-20-ai-personalized-learning.md

# 4. Resume at Task 3
# 5. Let it run — each task gets a fresh subagent with full review
```

---

*Plan created: March 20, 2026*
*Estimated completion: 1–2 weeks at current pace*
*Total remaining: 21 of 23 tasks*
