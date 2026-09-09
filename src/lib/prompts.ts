/**
 * Prompt library — tier-gated, static (zero migration).
 *
 * Gating rides `Organization.plan`, which already reaches the client through
 * the NextAuth session (`currentUser.organization.plan`). No new column,
 * no extra fetch, no DB migration.
 *
 * PROVENANCE (do not treat as approved copy):
 *   - The six `free` TITLES below are Atlas's verbatim Starter Six from
 *     spec addendum v1.1.
 *   - The prompt BODIES are CodeForge-authored drafts.
 *   - All 22 titles, categories, tags and pack fixtures are Atlas Gate
 *     v1.3 VERBATIM (ratified). Bodies are CodeForge drafts pending Brady.
 *
 * PLAN VALUES: the DB default is "free". Legacy insurance-era rows may carry
 * "starter"/"enterprise"; unknown values fail closed to the free tier rather
 * than over-unlocking paid content.
 */

export type PromptPlan = 'free' | 'pro' | 'studio'

/** Tier ladder, lowest first. A plan unlocks its own tier and everything below. */
export const PROMPT_PLAN_ORDER: PromptPlan[] = ['free', 'pro', 'studio']

export type Prompt = {
  id: string
  plan: PromptPlan
  title: string
  category: string
  body: string
  tags: string[]
}

export type PromptPack = {
  id: string
  name: string
  plan: PromptPlan
  tagline: string
  cta: string
}

/** Resolve an arbitrary/legacy plan string to a known tier, failing closed. */
function normalizePlan(plan: string | null | undefined): PromptPlan {
  return PROMPT_PLAN_ORDER.includes(plan as PromptPlan)
    ? (plan as PromptPlan)
    : 'free'
}

export function isPromptUnlockedForPlan(
  userPlan: string | null | undefined,
  promptPlan: PromptPlan,
): boolean {
  const userTier = PROMPT_PLAN_ORDER.indexOf(normalizePlan(userPlan))
  const promptTier = PROMPT_PLAN_ORDER.indexOf(promptPlan)
  return promptTier <= userTier
}

export type PromptWithUnlock = Omit<Prompt, 'body'> & (
  | { unlocked: true; body: string }
  | { unlocked: false; body?: never }
)

function promptMetadata(prompt: Prompt): Omit<Prompt, 'body'> {
  return {
    id: prompt.id,
    plan: prompt.plan,
    title: prompt.title,
    category: prompt.category,
    tags: prompt.tags,
  }
}

/**
 * All prompt metadata, annotated for the authorized plan. Bodies are included
 * only when that plan unlocks them so API responses cannot leak paid content.
 */
export function promptsForPlan(userPlan: string | null | undefined): PromptWithUnlock[] {
  return PROMPT_LIBRARY.map(prompt => {
    const unlocked = isPromptUnlockedForPlan(userPlan, prompt.plan)
    if (unlocked) return { ...prompt, unlocked }

    return { ...promptMetadata(prompt), unlocked }
  })
}

export const PROMPT_LIBRARY: Prompt[] = [
  // ── Starter Six (free) — titles per Atlas spec v1.1, bodies CodeForge draft ──
  {
    id: 'starter-follow-up-nudge',
    plan: 'free',
    title: 'Follow-up nudge',
    category: 'follow-up',
    tags: ['follow-up', 'nudge', 'client'],
    body: `You are helping a freelancer follow up with a client who has gone quiet.

Client / project: [name + what you were working on]
Last contact: [date + what was said]
What you need from them: [decision, feedback, payment, approval]

Write a short follow-up message that:
- References the specific next step, not a generic "checking in"
- Makes replying easy (one clear question or a yes/no)
- Stays warm and professional, with no guilt or pressure language
- Fits [email / SMS / LinkedIn DM]

Give me two versions: a soft nudge and a firmer one that proposes a deadline.`,
  },
  {
    id: 'starter-proposal-opener',
    plan: 'free',
    title: 'Proposal opener',
    category: 'proposals',
    tags: ['proposal', 'opener', 'scope'],
    body: `You are helping a freelancer open a proposal so the client keeps reading.

Client: [name + industry]
Their problem: [what is broken or missing today]
What I offer: [service / package]
Outcome they care about: [result, in their words]

Write the opening section of the proposal (max 120 words) that:
- Leads with their problem and the outcome, not my services
- Shows I understood their situation specifically
- Ends by naming what the rest of the proposal covers

No hype, no overclaiming, no promises about results you cannot control.`,
  },
  {
    id: 'starter-scope-creep-reply',
    plan: 'free',
    title: 'Scope-creep reply',
    category: 'proposals',
    tags: ['scope', 'boundary', 'reply'],
    body: `You are helping a freelancer respond to a client who keeps adding work beyond the agreed scope.

Agreed scope: [what was contracted]
New request: [what they just asked for]
Relationship: [new client / long-term / sensitive]

Write a reply that:
- Acknowledges the request as reasonable, not annoying
- Restates what is currently in scope
- Offers a clear path: include it as a paid addition, or queue it for later
- Keeps the relationship warm and avoids sounding defensive

Give me one firm version and one softer version.`,
  },
  {
    id: 'starter-invoice-chase',
    plan: 'free',
    title: 'Invoice chase',
    category: 'payments',
    tags: ['invoice', 'payment', 'chase'],
    body: `You are helping a freelancer chase an overdue invoice without damaging the relationship.

Client: [name]
Invoice: [number, amount, issued date, due date]
Days overdue: [n]
Previous reminders sent: [none / one / several]

Write a payment reminder that:
- States the facts plainly (invoice number, amount, due date)
- Asks for a specific action by a specific date
- Offers to help if there is an issue on their side
- Escalates tone appropriately for how overdue it is

Give me three escalating versions: first reminder, second reminder, final notice.`,
  },
  {
    id: 'starter-discovery-call-prep',
    plan: 'free',
    title: 'Discovery-call prep',
    category: 'discovery',
    tags: ['discovery', 'call', 'questions'],
    body: `You are helping a freelancer prepare for a discovery call with a potential client.

Prospect: [name / company / how they found me]
What they said they need: [their words]
My service: [what I actually do]

Give me:
1. Eight questions to ask, ordered so the call flows naturally — starting with their situation, moving to impact, then budget and timeline
2. Three things to listen for that tell me this is a good fit
3. Two red flags that mean I should walk away
4. A closing line that sets up the next step without being pushy`,
  },
  {
    id: 'starter-testimonial-ask',
    plan: 'free',
    title: 'Testimonial ask',
    category: 'social-proof',
    tags: ['testimonial', 'ask', 'proof'],
    body: `You are helping a freelancer ask a happy client for a testimonial.

Client: [name]
Project: [what was delivered]
Result they mentioned: [anything positive they already said]

Write a short message that:
- Asks at the moment of highest satisfaction, right after delivery
- Makes it easy: offer 2-3 specific questions they can answer in a sentence each
- Gives them permission to keep it brief
- Does not sound like a favour being extracted

Include the 3 guiding questions to send with the ask.`,
  },

  // ── Pro Ten — Atlas Gate v1.3 verbatim ──
  {
    id: 'pro-objection-handler',
    plan: 'pro',
    title: 'Objection diffuser',
    category: 'negotiation',
    tags: ['objection', 'negotiation', 'pricing'],
    body: `You are helping a freelancer respond to a client objection without discounting.

Objection: [e.g. "too expensive", "need to think about it", "found someone cheaper"]
Context: [stage of the deal, relationship]
My actual value: [what justifies the price]

Give me three responses that address the real concern behind the objection, hold the price, and keep the conversation moving. No manipulation tactics.`,
  },
  {
    id: 'pro-re-engagement-winback',
    plan: 'pro',
    title: 'Re-engagement winback',
    category: 'follow-up',
    tags: ['winback', 're-engagement', 'dormant'],
    body: `You are helping a freelancer re-engage a past client who has gone dormant.

Client: [name]
Last project: [what + when]
Why it may have lapsed: [budget, timing, no need]

Write a re-engagement message that references the past work specifically, offers a concrete reason to reconnect now, and asks one low-effort question.`,
  },
  {
    id: 'pro-case-study-writeup',
    plan: 'pro',
    title: 'Case-study writeup',
    category: 'social-proof',
    tags: ['case-study', 'proof', 'portfolio'],
    body: `You are helping a freelancer turn a completed project into a case study.

Project inputs: [client situation, what was done, what changed]

Structure it as: situation → approach → outcome. Keep claims to what actually happened, state numbers only if they are real and approved for use, and end with who else this would suit.`,
  },
  {
    id: 'pro-onboarding-kickoff',
    plan: 'pro',
    title: 'Onboarding kickoff',
    category: 'follow-up',
    tags: ['onboarding', 'kickoff', 'expectations'],
    body: `You are helping a freelancer kick off a new engagement cleanly.

Client + project: [details]
What I need from them: [access, assets, decisions]

Write a kickoff message that sets expectations, lists exactly what you need and by when, and names the first milestone. Warm but unambiguous.`,
  },
  {
    id: 'pro-rate-increase-notice',
    plan: 'pro',
    title: 'Rate-increase notice',
    category: 'payments',
    tags: ['rates', 'pricing', 'notice'],
    body: `You are helping a freelancer tell existing clients about a rate increase.

Current rate: [x]  New rate: [y]  Effective: [date]
Reason (honest, brief): [experience, scope, costs]

Write a notice that gives proper lead time, states the change plainly, honours current commitments, and does not over-explain or apologise excessively.`,
  },
  {
    id: 'pro-deposit-terms-script',
    plan: 'pro',
    title: 'Deposit + terms script',
    category: 'payments',
    tags: ['deposit', 'terms', 'contract'],
    body: `You are helping a freelancer introduce a deposit and clear terms to a new client.

Project: [scope + total]
Deposit: [%]  Terms: [cancellation, revisions, payment schedule]

Write the message that presents the deposit as standard practice, lists the key terms plainly, and tells them exactly what happens next to start.`,
  },
  {
    id: 'pro-referral-request',
    plan: 'pro',
    title: 'Referral request',
    category: 'outreach',
    tags: ['referral', 'request', 'growth'],
    body: `You are helping a freelancer ask a satisfied client for referrals.

Client: [name]  Relationship strength: [high / medium]

Write an ask that is specific about who would be a good fit, makes referring easy, and does not put the relationship at risk if they say no.`,
  },
  {
    id: 'pro-linkedin-outreach-dm',
    plan: 'pro',
    title: 'LinkedIn outreach DM',
    category: 'outreach',
    tags: ['linkedin', 'dm', 'outreach'],
    body: `You are helping a freelancer write a first LinkedIn DM to a potential client.

Person: [name, role, company]
Why them: [specific observation about their work]
My offer: [service]

Write a short DM under 80 words that references something real about them, states one specific way you could help, and asks a single low-friction question. No pitch deck, no fake familiarity.`,
  },
  {
    id: 'pro-cold-email-replies',
    plan: 'pro',
    title: 'Cold email that gets replies',
    category: 'outreach',
    tags: ['cold-email', 'email', 'replies'],
    body: `You are helping a freelancer write a cold email that earns a reply.

Target: [role, industry, company size]
Their likely pain: [specific]
My offer: [service]

Write a subject line plus body under 120 words. Lead with their situation, not my credentials. One clear call to action. Give me three subject line options ranked by likely reply rate.`,
  },
  {
    id: 'pro-content-calendar',
    plan: 'pro',
    title: 'Content calendar generator',
    category: 'content',
    tags: ['content', 'calendar', 'planning'],
    body: `You are helping a freelancer plan a month of client-facing content.

Niche: [who I serve]  Offer: [what I sell]  Platforms: [where]

Give me a four-week calendar with two posts per week. For each: the topic, the angle, the hook line, and the call to action. Mix proof, teaching, and personality. No generic motivational filler.`,
  },

  // ── Builder Six — Atlas Gate v1.3 verbatim ──
  {
    id: 'studio-offer-ladder',
    plan: 'studio',
    title: 'Offer ladder builder',
    category: 'offers',
    tags: ['offer', 'ladder', 'pricing'],
    body: `You are helping a freelancer build a tiered offer ladder.

Current service: [what you do]
Client type: [who]
Current price: [x]

Design three tiers (entry, core, premium). For each: name, what is included, what is explicitly excluded, who it suits, and a price. Make the middle tier the obvious choice without making the others look like punishment.`,
  },
  {
    id: 'studio-niche-positioning',
    plan: 'studio',
    title: 'Niche positioning statement',
    category: 'positioning',
    tags: ['positioning', 'niche', 'statement'],
    body: `You are helping a freelancer sharpen their positioning.

What I do: [service]
Who I serve best: [niche]
What makes me different: [real differentiator]

Write a one-sentence positioning statement, then a 40-word version for a website header, then three proof points that support it without overclaiming.`,
  },
  {
    id: 'studio-framework-naming',
    plan: 'studio',
    title: 'Signature framework naming',
    category: 'positioning',
    tags: ['framework', 'naming', 'brand'],
    body: `You are helping a freelancer turn their process into a named framework.

My actual process: [steps you really follow]
Client outcome: [result]

Give me five framework names with a short rationale each. For the strongest one, lay out the stages with what happens in each and what the client receives. The name must describe a process you actually run, not a hollow acronym.`,
  },
  {
    id: 'studio-lead-magnet-outline',
    plan: 'studio',
    title: 'Lead magnet outline',
    category: 'marketing',
    tags: ['lead-magnet', 'marketing', 'outline'],
    body: `You are helping a freelancer design a lead magnet that attracts the right clients.

Niche: [who]  Offer: [what you sell]  Format: [checklist / template / guide]

Outline it: title options, the promise, section-by-section contents, and the final call to action that leads to a conversation. It must deliver real value on its own, not act as a teaser that withholds the point.`,
  },
  {
    id: 'studio-launch-sequence',
    plan: 'studio',
    title: 'Launch sequence (5 emails)',
    category: 'marketing',
    tags: ['launch', 'email', 'sequence'],
    body: `You are helping a freelancer launch an offer to their list.

Offer: [what]  Price: [x]  Audience: [who]  Window: [open/close dates]

Write five emails: announcement, value/teaching, social proof, objection handling, and final call. For each give the subject line and the body. Honest urgency only — state real deadlines and real limits, never invent scarcity.`,
  },
  {
    id: 'studio-authority-post-series',
    plan: 'studio',
    title: 'Authority post series',
    category: 'content',
    tags: ['authority', 'posts', 'series'],
    body: `You are helping a freelancer build authority in their niche through a post series.

Niche: [who]  Point of view: [what you actually believe that others do not]

Give me a six-post series. For each: the hook, the core argument, one concrete example, and a closing line. The series must build a single coherent argument across all six, not repeat the same tip in different clothes.`,
  },
]

/** Pack fixtures — Atlas Gate v1.3 verbatim. */
export const PROMPT_PACKS: PromptPack[] = [
  { id: 'starter', name: 'Starter Six', plan: 'free', tagline: 'Your first six client prompts — free, forever.', cta: 'Open Prompts' },
  { id: 'pro', name: 'Pro Ten', plan: 'pro', tagline: 'Negotiation, outreach, and growth scripts.', cta: 'Unlock with Pro' },
  { id: 'builder', name: 'Builder Six', plan: 'studio', tagline: 'Offers, positioning, launch sequences.', cta: 'Unlock with Studio' },
]
