# PROJECT MEMORY

This file is the persistent project memory for the RevenueWatch website and app.
Use it at the start of future chats so work can continue without relearning the project from scratch.

---

## GitHub Location

- GitHub repo: `Miguel-0721/RevenueWatch`
- Remote URL: `https://github.com/Miguel-0721/RevenueWatch.git`
- Default recovery branch: `main`
- Working rule:
  - Work locally first
  - Review locally
  - Push to GitHub `main` only after user approval

---

## Algemeen

RevenueWatch is a simple monitoring and alerting product for Stripe.

Core idea:
- It watches connected Stripe accounts in the background.
- It detects unusual revenue drops and payment failure spikes.
- It alerts the user early.
- It does not move money.
- It does not change Stripe settings.
- It is read-only.

One-line explanation:
- RevenueWatch is a safety alarm / early-warning system for Stripe revenue issues.

Important positioning:
- Not an analytics platform.
- Not an AI insights platform.
- Not a money management tool.
- Not a forecasting tool.
- It is a calm, trustworthy early-warning system for Stripe revenue issues.

---

## Current Status Snapshot

As of the latest update:
- Branch: `main`
- Last known pushed commit before this memory refresh: `019fb14`
- Landing page: in a good state, visually strong, still open to refinement but no longer in rescue mode.
- Login page: redesigned and simplified; good direction, but still open to one more polish pass if needed.
- Dashboard redesign: not started yet in implementation, but Stitch dashboard export has been discussed and should be used as the source of truth.

Current major direction:
- Marketing site should now focus on refinement, conversion clarity, and consistency.
- Dashboard redesign is the next major product surface to tackle.

---

## Product Summary

RevenueWatch watches Stripe accounts in the background and alerts the user when something unusual happens.

Examples:
- Revenue suddenly drops compared with the normal trend.
- Payment failures spike unexpectedly.

Outcome:
- The user finds out before customers or clients do.

Important trust rules:
- Read-only access.
- No money movement.
- No editing of Stripe settings.
- Secure OAuth connection.

---

## Brand and Design Rules

Overall brand tone:
- Calm
- Trustworthy
- Professional
- Stripe-adjacent, but not derivative
- Clear, not hype-driven

Color system:
- Primary accent: strong but clean RevenueWatch blue
- Base backgrounds: white / cool light gray
- Text: near-black / dark gray
- Support colors: subtle cool grays
- Alert / danger accents: controlled red only where needed

Avoid:
- Purple-led SaaS aesthetics
- Dark mode bias on marketing pages unless intentionally requested
- Generic “AI startup” gradients
- Overly flashy motion
- Too many section treatments that all look the same

Typography:
- Keep strong, editorial-ish SaaS hierarchy
- Favor clear, controlled headings
- Avoid giant headline scale unless it is clearly justified
- Supporting text should remain readable and quieter than the headings

Logo and brand mark:
- The site layout is currently stronger than the brand mark
- Brand polish is still a future improvement area
- Do not casually replace logo treatment without checking consistency across navbar, footer, login, and dashboard

---

## Visual Principles

1. The site should feel premium, clean, and intentional.
2. Not every section should use the same layout rhythm.
3. Contrast and section identity matter more than adding more content.
4. Hero should feel spacious and controlled, not oversized and not squished.
5. Trust sections should feel calm.
6. Risk sections can feel slightly sharper, but should not become fear-marketing.
7. Value sections should feel concrete, not decorative.

---

## Layout and Sizing Guardrails

This section is critical. Future Codex chats were creating oversized layouts, giant cards, and too much empty space. Use these rules before making any new marketing or auth page.

### Site shell rules

- Main content shell:
  - max width: `1120px`
  - horizontal padding: `24px`
- Hero shell:
  - max width: `1200px`
  - horizontal padding: `24px`
- Navbar/footer shell:
  - max width: `1240px`
  - horizontal padding: `24px`

Do not make all sections full-width just because the screen is large.

Preferred width hierarchy:
1. Navbar/footer widest
2. Hero slightly narrower
3. Main body sections tighter

### Header rules

- Topbar height: `64px`
- Sticky/fixed navbar is acceptable only if:
  - near-solid background
  - no text bleed-through
  - subtle border/shadow only
- Body offset must match topbar height if navbar is fixed.

### Hero rules

Current good implementation targets:
- Hero section padding: roughly `28px 24px 72px`
- Hero grid:
  - left content flexible
  - right widget max width around `460px`
  - gap around `40px`
  - desktop minimum height around `600px`

Hero headline guardrail:
- desktop clamp: `clamp(2.3rem, 5.1vw, 3.45rem)`
- line-height: `1`
- weight: `800`
- letter-spacing: around `-0.065em`

Do not let homepage or auth headlines grow much beyond this without a very good reason.

Hero body copy guardrail:
- max width: about `27rem`
- font size: around `0.95rem`
- line-height: around `1.6`

Hero CTA row:
- buttons min height: around `48px`
- font size: around `0.94rem`

### Section heading rules

- Standard centered section heading:
  - clamp around `1.75rem` to `2.3rem`
- Pricing heading:
  - slightly smaller than hero
  - clamp around `1.7rem` to `2.2rem`
  - max width around `18ch`

Do not make every section heading giant. That was one recurring cause of oversized page feel.

### Section spacing rules

General section rhythm:
- avoid giant vertical gaps
- most sections should live in the `60px` to `68px` vertical padding range on desktop
- hero can be larger
- pricing and footer should not create huge dead space below cards

### Card rules

- Marketing cards should usually have:
  - radius around `20px`
  - padding around `28px`
- Do not default to giant equal cards everywhere.
- Repeated three-card sections are only okay if each section has a distinct role/background/layout.

### Pricing rules

Pricing is a known risk area for oversizing and awkward proportions.

Use these guardrails:
- pricing grid max width: around `62rem`
- three cards with gap around `20px`
- card padding around `28px`
- price number font size around `2.55rem`
- feature list font size around `0.83rem`

Do not:
- make pricing heading too dominant
- make cards too tall and too narrow
- let feature lines wrap awkwardly because the grid is too compressed

### Auth/login rules

Login page must be calmer and smaller than homepage.

Do:
- use a shorter headline
- keep one auth card as the main focus
- keep layout branded but minimal

Do not:
- treat login like a full marketing hero
- use giant homepage-size headline on auth
- add too many secondary info panels

### Background/surface rules

Background changes between sections must be intentional.

Preferred:
- hero: white or white with soft controlled glow
- risk section: cooler light gray, but not hero-like blue glow
- value section: white
- trust section: its own stronger visual treatment
- process section: neutral surface with clear grouping

Avoid:
- sections blending together because they all use the same pale blue-white glow
- random background shifts with no role meaning

---

## Section Identity Rules

These are important because one repeated problem on the site was that multiple sections looked too similar.

### Hero
- High-impact, but controlled
- Strong headline + trust line + action
- Product widget or monitoring card on the right

### What happens without RevenueWatch?
- Risk-oriented section
- Can use a cooler gray surface or distinct section background
- Should not visually feel like a second hero
- Should not feel identical to trust/value sections

### Secure, calm monitoring.
- Trust section
- Best expressed with the Stitch bento-style layout already adopted
- This is one of the strongest sections on the current site

### What RevenueWatch saves.
- Value section
- Should feel concrete and useful, not just decorative
- Visual widgets are okay, but must not break layout or overlap text

### How it works.
- Process clarity
- Outcome-driven copy is preferred over dry process copy
- This section should feel believable and product-real, not abstract

### Pricing
- Clear, easy to compare
- Middle plan featured
- Heading should not overpower the cards

---

## Messaging Rules

RevenueWatch messaging should remain:
- Calm
- Specific
- Trustworthy
- Grounded in real operational risk

Avoid:
- Overblown fear marketing
- Claims that imply autonomous protection or financial control
- Heavy “AI” framing
- Vague “insights” language that suggests a broader product than exists

Preferred product framing:
- Early-warning system
- Revenue monitoring
- Payment failure detection
- Revenue drop alerts
- Read-only monitoring
- Alerting before damage spreads

Avoid framing it as:
- Full analytics
- Business intelligence
- Forecasting
- Revenue optimization engine
- “Protection system” if it sounds too inflated

Best short framing:
- RevenueWatch is an early-warning system for Stripe revenue issues.

---

## Strong Messaging Patterns

Good hero direction:
- Catch payment failures and revenue drops before your clients do.

Good trust line direction:
- Read-only access. No money movement. No risk.

Good login direction:
- Connect your Stripe account
- Sign in to connect your Stripe account and start monitoring.

Good CTA direction:
- Protect your revenue
- Connect your Stripe account
- Continue with Google

Avoid:
- “Use your existing work account” unless truly needed
- Generic “Try it” CTAs
- Neutral wording that adds friction

---

## Copy Rules

Text on the site should:
- Be scannable in a few seconds
- Use short paragraphs
- Avoid unnecessary technical jargon
- Avoid cold or robotic trust language when human wording would work better

What to sharpen:
- Risk copy can be slightly stronger
- Value copy should be more concrete
- Trust copy should sound simple and reassuring, not overly technical

What not to over-cut:
- This is B2B and touches Stripe OAuth / money-adjacent trust
- Users do need a reasonable level of explanation

---

## Navbar and Footer Rules

### Navbar
- Preferred behavior: sticky
- Preferred surface: solid or near-solid off-white
- Allowed: subtle blur only if content does not bleed through
- Not allowed: highly transparent sticky navbar with text bleeding under it
- Navbar should feel like a stable top frame

Navbar width rule:
- Navbar shell can be slightly wider than main content

Navbar CTA logic:
- Marketing site CTA has often been `Connect Stripe`
- On login page, CTA may need to switch to `Sign in`
- Keep navbar wording consistent with the current user state where practical

### Footer
- Footer shell can also be slightly wider than main body content
- Footer should feel calm, simple, and consistent with navbar
- Footer does not need heavy decoration

---

## Landing Page Structure

Current preferred section order:

1. Hero
2. What happens without RevenueWatch?
3. What RevenueWatch saves.
4. How it works.
5. Secure, calm monitoring.
6. Pricing
7. Assurance strip
8. Footer

### Why This Order

- Hero establishes problem and promise.
- Risk section adds urgency.
- Value section explains the payoff before detailed process.
- How it works explains mechanism once the user already cares.
- Trust section still appears before pricing, but not so early that it slows momentum.
- Pricing comes after value has been established.

Important note:
- There was external critique suggesting `Problem -> Solution -> Benefits -> Trust -> Pricing`.
- We did not adopt that literally.
- We chose a modified version that keeps trust present without pushing it too late.

---

## Landing Page Design Decisions

Accepted:
- Value section should come above How it works.
- Trust should not be pushed all the way to the end.
- Pricing should stay after value explanation.
- Section backgrounds must feel intentional and not repetitive.
- Repeated three-card sections should be avoided or differentiated.

Not accepted:
- Turning the site into a highly aggressive fear-based sales page
- Moving trust too late
- Over-cutting explanatory text

---

## Critique Decisions Accepted

From external critique and internal review, these ideas were accepted:
- Stronger hero messaging
- Sharper CTA language
- Strong trust line
- Add `What happens without RevenueWatch?`
- Add `What RevenueWatch saves.`
- Make value more concrete
- Treat pricing as a perceived-value problem, not only a raw price problem

---

## Critique Decisions Rejected or Modified

Rejected or modified ideas:
- Do not move trust too late.
- Do not turn the site into a generic pain-driven conversion template.
- Do not automatically reduce pricing just because it “feels high” without looking at target customer and perceived value together.
- Do not strip too much explanatory text from a B2B Stripe-connected product.

---

## Login and Auth Rules

Current auth system:
- NextAuth/Auth.js
- Prisma adapter
- Google OAuth active
- Microsoft / Entra ID discussed and may be added later
- No email/password account creation flow

Current auth principle:
- Login should feel like step 1 of onboarding, not a generic login page
- But it should still be calmer and simpler than the marketing homepage

Auth page should:
- Keep RevenueWatch branding
- Reuse navbar and footer
- Be cleaner and more minimal than homepage
- Focus on one main action: sign in

Auth page should not:
- Feel like a separate product
- Feel like a full landing page clone
- Add unnecessary friction with wording like `work account` if not required

---

## Login Page Direction

Current preferred direction:
- Branded but simplified
- Left: short context
- Right: auth card
- Footer/navbar remain

The login page was iterated through multiple states:
- First version: too elaborate, too much like a landing page
- Second version: cleaner but too plain/basic
- Current preferred direction: middle ground

### Login Page Copy Direction

Preferred:
- Headline: `Connect your Stripe account` or other onboarding-oriented phrasing
- Supporting text: `Sign in to connect your Stripe account and start monitoring.`
- Primary CTA: `Continue with Google`

Avoid:
- `Use your existing work account`
- overly long explanatory paragraphs
- too much secondary auth/status text

### Login Design Rules

- Less visual noise than the homepage
- Keep card as primary focus
- Left headline should not feel like a homepage hero
- Background glow should be subtle
- Microsoft option should not dominate if it is not ready

Current note:
- Microsoft “coming soon” introduced unnecessary unfinished-product energy in review
- Better to hide or heavily de-emphasize it until real

---

## Dashboard Direction

The dashboard redesign has not been implemented yet, but these rules are already agreed:

1. The Stitch dashboard export should be used as the source of truth.
2. The Stitch content is not random placeholder UI.
3. The cards, alerts, metrics, and account blocks should be treated as examples of realistic Stripe-connected RevenueWatch monitoring data.
4. Dashboard redesign should preserve navbar and footer unless there is a strong product reason not to.
5. The redesign should feel like connected Stripe company/account monitoring, not just decorative admin UI.

Important:
- When implementing dashboard, interpret Stitch’s visuals as sample product-state content for connected companies / Stripe accounts.

---

## Stitch Sources of Truth

General rule:
- Stitch exports provided by the user are the source of truth for major design direction.

Key uses so far:
- Landing page hero and structure
- `Secure, calm monitoring.` redesign
- `What RevenueWatch saves.` redesign
- Upcoming dashboard redesign

When using Stitch:
- Match the design language closely
- But adapt to the real product structure and current RevenueWatch identity
- Keep navbar/footer consistent with the current site unless explicitly changing them

---

## Coding and Implementation Notes

This section is here so future work can restart quickly without rediscovering patterns.

### General implementation approach

- The repo is a Next.js App Router app.
- Public marketing pages use a shared visual language built from custom CSS modules and shared chrome.
- Manual file edits should use `apply_patch`.
- Prefer reading existing implementation before changing patterns.
- User strongly prefers working locally first and only pushing after approval, unless explicitly asking to push.

### Local workflow preference

- Edit locally
- Review in browser/screenshots
- Push only after user confirms

### Existing implementation themes

- The site does not rely on a full component library for marketing pages
- Design has been implemented mainly through custom React + CSS modules
- Stitch exports are translated into modular page sections, not pasted wholesale

### Important behavior preference

- Do not casually reset/revert user work unless explicitly asked
- User uses GitHub `main` as a recovery point
- User often asks to revert to GitHub main if they dislike a direction

---

## Auth Implementation Notes

Known implementation state from previous inspection:
- Auth config lives in `src/auth.ts`
- Uses NextAuth/Auth.js with Prisma database sessions
- Google provider active
- Login page at `src/app/login/page.tsx`
- Dashboard access checks `auth()`

Important behavioral rule:
- There is no email/password sign-up flow
- Continue to treat OAuth login as the only access path unless requirements change

---

## Dashboard Implementation Notes

When redesigning dashboard later:
- Start by reading existing dashboard route and components
- Compare them against Stitch export
- Keep navbar/footer unless the app shell requires a product-layout variation
- Preserve functional behavior while redesigning visuals
- Use realistic fake/sample Stripe account and alert data where necessary

Likely next implementation priority:
- Redesign dashboard using Stitch export `(9)` or whichever latest dashboard-specific Stitch source the user references next

---

## Marketing Implementation Notes

Landing page now includes:
- Hero
- Risk section
- Value section
- How it works
- Secure, calm monitoring
- Pricing
- Assurance strip
- Footer

Known good sections:
- Hero
- `Secure, calm monitoring.`
- `How it works.`

Sections still open to refinement:
- `What happens without RevenueWatch?`
- `What RevenueWatch saves.`
- Pricing value alignment
- Logo/brand distinctiveness

---

## What To Keep

- Calm trustworthy tone
- Blue/white RevenueWatch palette
- Strong hero
- Bento-style trust section
- Clear pricing structure
- Shared navbar/footer
- OAuth-only auth flow
- Stripe-read-only trust emphasis

---

## What Not To Change Carelessly

- Product positioning
- Read-only / no money movement trust framing
- Section order without deliberate reason
- Shared chrome consistency
- Pricing structure without considering value perception
- Login page simplicity once it reaches the right balance
- Layout guardrails in this file

---

## Change History / What We Already Changed

High-level historical summary:

### Marketing site
- Multiple passes to reduce oversized typography and spacing
- Header/footer shell widened relative to body shell
- Hero widened relative to body shell
- Hero centering fixed
- Pricing refined multiple times
- `Secure, calm monitoring.` and `What RevenueWatch saves.` redesigned to match Stitch-based designs
- Section background logic refined
- Navbar transparency issue discovered and corrected
- Sticky navbar adopted with solid/near-solid treatment

### Messaging
- Hero copy sharpened
- Trust line added
- `What happens without RevenueWatch?` added
- `What RevenueWatch saves.` added
- `How it works.` rewritten to be more outcome-driven
- Value-before-pricing structure adopted

### Login
- Originally too elaborate
- Then simplified
- Then debated for balance between too much and too basic
- Final preferred direction still may need one more refinement round, but overall goal is clear: branded, calm, and simple

### Git/GitHub behavior
- User frequently asks to revert to GitHub `main`
- Local experimentation is normal
- Pushes happen only after confirmation unless explicitly requested

---

## Recent Decisions

Latest explicit decisions to remember:
- Update this file so future chats can resume quickly
- Include implementation notes and general project evolution
- Track what was changed and why
- Use this file as persistent project memory
- Add GitHub repo location to the file
- Add concrete layout and sizing rules so future Codex chats do not create oversized boxes, giant spacing, or oversized typography

Design-related recent decisions:
- Sticky navbar is acceptable only if solid and clean
- `What happens without RevenueWatch?` should not visually feel like a second hero
- `What RevenueWatch saves.` should sit above `How it works.`
- Login should feel like onboarding, not a generic login page

---

## Open Questions / Unresolved

1. Pricing / perceived value alignment
- Does the current paid pricing feel justified by the site and current feature set?
- Should pricing be lowered or should perceived value be strengthened instead?

2. Login page final balance
- Where is the right midpoint between too elaborate and too basic?

3. Microsoft auth timing
- Should Microsoft remain hidden until implemented?
- Or shown in a heavily de-emphasized way later?

4. Brand distinctiveness
- Site is strong, but logo/brand system may still need improvement later

5. Dashboard implementation details
- Which exact Stitch export is the final source of truth?
- How closely should example Stripe company/account data be mirrored?

---

## Current Priorities

Immediate:
- Keep this file current
- Preserve current landing-page quality
- Refine login only if necessary

Next major product task:
- Dashboard redesign from Stitch

Secondary:
- Pricing/value review
- Brand/logo refinement

---

## Next Priorities

Recommended next work sequence:

1. Dashboard redesign using Stitch export
2. Final login-page polish if needed
3. Pricing/value alignment review
4. Brand/logo polish
5. Any final conversion-focused copy tuning

---

## How To Use This File Later

At the start of a future chat:

1. Read this file first.
2. Treat it as the current project memory.
3. Use it to avoid repeating old mistakes.
4. Update it whenever major design, structural, messaging, or workflow decisions are made.

This file should be updated whenever:
- the section order changes
- a major visual rule changes
- login/dashboard direction changes
- pricing direction changes
- a new Stitch source of truth is adopted
- a repeated critique is accepted or rejected" update the current memory file with things we changed since i last told you

---

## Memory Update - 2026-04-21

This section was appended after the dashboard, navbar, webhook calculation, and account-detail work. Do not delete older notes above; treat this section as the current state override where older sections say the dashboard was not implemented yet.

### Current Git / Repo State

- Repo remains `Miguel-0721/RevenueWatch`.
- Work is still local unless pushed by explicit user request.
- Current branch used for work: `main`.
- A previous dashboard redesign commit was pushed earlier: `519e505 Redesign dashboard from Stitch reference`.
- Current local work after that push includes changes in:
  - `src/app/api/stripe/webhook/route.ts`
  - `src/app/dashboard/accounts/[accountId]/page.tsx`
  - `src/app/globals.css`
  - `src/components/Navbar.tsx`
  - `src/components/AppNavLinks.tsx`

### Dashboard Redesign Is Now Implemented

The old note saying dashboard redesign was "not started yet" is outdated.

Dashboard work completed:
- The dashboard was redesigned from the Stitch dashboard reference.
- The dashboard now uses the same navbar/footer chrome as the rest of the site.
- Dashboard width and spacing were adjusted so content is contained like the landing page instead of stretching past the navbar.
- Temporary test/sample dashboard data was added so the dashboard can be reviewed in a filled state.
- Temporary sample data includes 10 connected companies/accounts.
- Some sample accounts are normal; some show critical or review-needed issues.
- The user explicitly wants this temporary sample data to be removable later.

Important dashboard sample-data note:
- The temporary dashboard data is for design testing only.
- Do not treat sample company data as permanent production data.
- Preserve the ability to remove or disable the sample data later.

Dashboard layout decisions:
- Left side should prioritize `Accounts Needing Attention`.
- `Active alert log` can sit lower because it is more operational detail.
- Right side should show `Connected Accounts` and recent history.
- `Connected Accounts` supports show-all/collapse behavior.
- `Add Account` belongs inside the dashboard connected-account area, not necessarily in the global navbar.
- The connected-account list should not feel compressed; prefer readable spacing and a contained card.
- Dashboard should feel like a real Stripe-monitoring command center, not a decorative admin template.

### Navbar / App Chrome Changes

Navbar work completed:
- Logged-out and logged-in navbar treatments were made more consistent.
- The logged-in app nav now uses app-specific links:
  - `Dashboard`
  - `Accounts`
  - `Alerts`
- `Add Account` was removed from the global logged-in navbar because the dashboard already has account-management context.
- The user name is shortened in the navbar to first name only.
- The sign-out button was softened so it does not compete with primary actions.
- Active nav underline was restored.
- Hover underline behavior was added/recommended for other navbar links.
- Brand link should navigate home when clicking `RevenueWatch`.
- Logo/wordmark blue was changed to use the same stronger RevenueWatch primary blue used in the text.

Implementation note:
- `src/components/AppNavLinks.tsx` was added as a client component for route/hash-aware app nav active states.
- `src/components/Navbar.tsx` uses it for logged-in nav behavior.

Navbar product guidance:
- Marketing navbar can keep centered navigation because it supports browsing the public site.
- Logged-in navbar does not need to perfectly mirror public navbar layout; authenticated users need app navigation and account context.
- Avoid duplicating `Add Account` globally if the dashboard already has the action in the right context.

### RevenueWatch Calculation Specification

RevenueWatch detects anomalies by comparing current behavior against historical behavior.

Core properties:
- Read-only.
- Conservative: prefer false negatives over false positives.
- Event-driven: runs when Stripe events arrive.
- No predictions.
- No recommendations.
- No automated actions.
- No money movement.
- No AI decision-making.

Hard rule:
- Revenue is not uniform across time.
- Different days behave differently.
- Different hours behave differently.
- Do not compare Monday to Sunday.
- Do not compare Friday to Monday.
- Do not compare Monday 20:00 to Monday 10:00.
- Correct comparison starts with same `dayOfWeek` and same `hourOfDay`.

### Revenue Drop Alert Logic

Purpose:
- Detect when current revenue is significantly lower than expected for the same day/time context.

Stored payment event data:
- `amount` in cents.
- `timestamp`.
- `hourOfDay` from UTC hour.
- `dayOfWeek` from UTC day.

Current production-oriented constants:
- `REVENUE_WINDOW_MINUTES = 60`
- `BASELINE_HOURS = 6 * 7 * 24` (about six weeks)
- `MIN_SAMPLES = 5`
- `DROP_THRESHOLD = 0.5`

Current revenue:
- Sum successful payments where `timestamp >= now - REVENUE_WINDOW_MINUTES`.

Baseline fallback order:
1. `same_day_and_hour`: same `dayOfWeek` and same `hourOfDay`.
2. `same_day_type_and_hour`: same weekday/weekend bucket and same `hourOfDay`.
3. `same_hour`: same `hourOfDay` only.
4. If still fewer than `MIN_SAMPLES`, do not evaluate and do not trigger.

Important:
- Never skip directly to broader averages if stricter matches have enough samples.
- Historical windows must match the same duration as the current window.
- Baseline is the average of matching historical windows.

Revenue guard conditions:
- Do not evaluate or trigger if sample count is below `MIN_SAMPLES`.
- Do not trigger if baseline/current values fail configured minimum guards.
- Do not trigger if alert is active or within cooldown.

Trigger:
- `dropRatio = (baselineAmount - currentAmount) / baselineAmount`
- Trigger revenue alert when `dropRatio >= DROP_THRESHOLD`.
- Start cooldown.

Known limitation:
- The system is event-driven.
- If no Stripe events arrive, no evaluation happens.
- Full inactivity detection would require a scheduled job later.

### Payment Failure Spike Logic

Purpose:
- Detect when payment failures suddenly exceed a safe threshold.

Current production-oriented constants:
- `FAILURE_WINDOW_MINUTES = 30`
- `FAILURE_THRESHOLD = 5`

Logic:
- Count failed payment events in the last 30 minutes.
- Trigger alert when failure count reaches the fixed threshold.
- Start cooldown.
- Do not trigger again during cooldown.

Important design decision:
- Payment failure alerts do not use historical baseline comparison.
- Reason: failures are rare and inconsistent; a fixed spike threshold is more stable and conservative.

UI wording rule:
- Do not describe payment failures as "higher than normal baseline" unless backend actually calculates a baseline.
- Correct wording: fixed spike threshold, threshold reached, failed payments counted in the current window.

### Webhook Implementation Notes

Main backend calculation file:
- `src/app/api/stripe/webhook/route.ts`

Current implementation state:
- Revenue current window is now 60 minutes, not the old 2-minute debug value.
- Payment failure threshold is now 5, not the old debug value of 2.
- Revenue baseline fallback hierarchy is implemented.
- Revenue metric bucketing now uses UTC consistently:
  - `getUTCHours()`
  - `getUTCDay()`
- Baseline lookup also uses UTC.
- Revenue historical summary grouping also uses UTC.

Current revenue alert context shape includes:
- `dropRatio`
- `baselineHours`
- `baselineAmount`
- `baselineLevel`
- `baselineLabel`
- `baselineSampleCount`
- `currentWindowMinutes`
- `currentAmount`
- `threshold`
- `alertThresholdAmount`
- `amountUnit: "cents"`
- `currency: "EUR"`
- `dayOfWeek`
- `hourOfDay`

Current payment failure alert context shape includes:
- `failuresCounted`
- `failureThreshold`
- `failureWindowMinutes`

Trust rule:
- UI must explain alerts using these real backend context keys, not old demo-only keys.

### Account Detail Page Notes

Main account detail UI file:
- `src/app/dashboard/accounts/[accountId]/page.tsx`

Current state:
- The account detail page now reads real webhook context keys.
- Revenue UI supports backend keys like `baselineAmount`, `currentAmount`, `currentWindowMinutes`, `threshold`, `baselineLabel`, and `baselineSampleCount`.
- Payment failure UI supports backend keys like `failuresCounted`, `failureThreshold`, and `failureWindowMinutes`.
- Legacy/demo keys are still supported as fallback where useful.
- The `Measured over` card now uses the parsed revenue/payment window label instead of requiring a legacy `window` key.
- Payment failure explanation now correctly says it is fixed-threshold based, not baseline based.
- Revenue threshold display now uses the backend drop threshold.
- The supporting revenue grid explicitly says it is illustrative supporting context, not a full reconstruction of every historical payment.
- The highlighted revenue time block now derives from real alert `hourOfDay`:
  - 6-12 = Morning
  - 12-18 = Afternoon
  - 18-22 = Evening
  - 22-6 = Late night

Important remaining truth:
- The full-day revenue pattern grid is still illustrative.
- It is not yet built from real historical payment windows.
- This is acceptable for now because the wording says it is supporting context, but later a more trustworthy version should derive it from actual `revenueMetric` data.

### Verification Notes

Verification performed after the calculation/UI alignment work:
- `npx.cmd tsc --noEmit` passes.

Known unrelated lint state:
- `npm.cmd run lint` still reports pre-existing or unrelated issues unless separately fixed.
- Known examples include:
  - `scripts/seedBaseline.ts`
  - `src/app/api/stripe/disconnect/route.ts`
  - `src/app/page.tsx`
  - `src/auth.ts`
  - `src/components/Navbar.tsx` image warning

Do not treat the lint failures as caused only by the latest RevenueWatch calculation changes without checking.

### Current Product Direction After This Update

Next recommended work:
1. Review the account detail page visually now that backend explanations are aligned.
2. Decide whether the account detail page should get a real chart for revenue velocity.
3. If adding a chart, it should show:
   - Current revenue line.
   - Expected/baseline line for the matched day/hour context.
   - Alert threshold line.
   - Same-day/same-hour logic in labels.
4. Eventually replace illustrative revenue pattern grid with real data from stored revenue metrics.
5. Keep payment failure UI threshold-based unless backend logic changes.

Advisor note:
- The product should not add "clear history" or "clear active alerts" casually.
- Alert history is audit/context data.
- If controls are added later, prefer archive/resolve/acknowledge behavior over destructive clearing.

---

## Memory Update - Account Detail View Started

Account detail work has now started and should be treated as the next major app surface.

Implemented in `src/app/dashboard/accounts/[accountId]/page.tsx`:
- Added a `RevenueMonitorCard` with an inline SVG chart.
- The chart shows:
  - Actual revenue line.
  - Expected historical baseline line.
  - Alert threshold line.
  - Active point for the current alert/hour.
- The chart language intentionally says historical baseline, not forecast or prediction.
- Added active alert log for the selected account.
- Added recent history / previous incidents for the selected account.
- Account detail sample IDs were aligned with dashboard sample IDs:
  - `acct_sample_atlas`
  - `acct_sample_northstar`
  - `acct_sample_bluepeak`
  - `acct_sample_meridian`
  - `acct_sample_luma`
  - `acct_sample_forge`
  - `acct_sample_cedar`
  - `acct_sample_pixel`
  - `acct_sample_brightgrowth`
  - `acct_sample_nova`
- Demo/sample account detail pages now skip unnecessary Prisma reads before falling back to sample data.

Current account detail principle:
- The page should explain the account state, not just look like analytics.
- It should answer:
  - Is this account healthy right now?
  - What triggered the alert?
  - What was expected for the matched day/hour?
  - What actually happened?
  - What active and past alerts exist?

Remaining account detail improvement:
- The revenue chart is currently generated from alert context/sample defaults.
- Later, the chart should be backed by real `RevenueMetric` historical/current data.

---

## Memory Update - Stitch 13 Account Detail Direction

The account/company detail page direction has been changed again after comparing Stitch exports `(12)` and `(13)`.

Decision:
- Use `stitch_revenuewatch_landing_page (13).zip` as the visual/layout source of truth for account detail.
- Treat Stitch as layout/design direction, not final product copy.
- Do not copy Stitch wording like `Node`, `Network`, `Admin`, `Agent`, or `Sovereign` unless those become real RevenueWatch concepts.

Implemented direction:
- Rebuilt `src/app/dashboard/accounts/[accountId]/page.tsx`.
- Added `src/app/dashboard/accounts/[accountId]/page.module.css`.
- Layout now follows Stitch `(13)` more closely:
  - Top account header with status pill, account ID, and actions.
  - Large full-width revenue chart card.
  - Compact metric cards below the chart.
  - Lower split layout with active/recent alerts on the left and resolved alerts on the right.
  - Light gray canvas, white cards, sharper corners, uppercase micro-labels, blue/red status language.
- The page keeps RevenueWatch calculation language:
  - `Expected baseline`, not `Historical Mean` if that wording is clearer.
  - `Alert threshold`, not forecast/prediction.
  - Payment failures remain fixed-threshold based.
- The page still uses shared RevenueWatch navbar/footer for product consistency.

Current caution:
- This rebuild has passed TypeScript, but still needs browser visual review.
- If the user says it does not match Stitch closely enough, tighten spacing, card radii, chart height, and typography against Stitch `(13)` screenshot.

---

## Memory Update - 2026-04-23 Account Detail Graph/Data Iteration

This section records the latest account-detail and chart work. Keep all older memory above, but treat this section as the current override for account-detail graph behavior and demo data.

### Current Account Detail Files

Primary files:
- `src/app/dashboard/accounts/[accountId]/page.tsx`
- `src/app/dashboard/accounts/[accountId]/page.module.css`

Related logic file:
- `src/app/api/stripe/webhook/route.ts`

Current account-detail route examples:
- `/dashboard/accounts/acct_sample_atlas`
- `/dashboard/accounts/acct_sample_northstar`
- `/dashboard/accounts/acct_sample_luma`
- `/dashboard/accounts/acct_sample_forge`

### Account Detail Design Direction

The account-detail page is currently a Stitch-inspired product screen, but the wording and data must remain RevenueWatch-specific.

Current layout:
- Shared RevenueWatch navbar.
- Account header with status pill, account ID, and action buttons.
- Main monitoring card with chart on the left.
- Current-state/current-issue details panel on the right.
- Lower alert/history area.
- Shared footer.

Design principles accepted:
- The chart should not stretch full-width without useful supporting information.
- Putting the issue/state panel to the right of the graph improves the layout and prevents the graph from feeling too wide.
- Do not over-color the right-side panel. Heavy red panels felt too aggressive. Keep the panel mostly white with subtle red accents when there is an issue.
- Blue should represent normal/monitoring state. Red should represent active issue state.
- Avoid duplicating the same key values both below the chart and inside the right-side panel.

Recent design cleanup:
- Removed redundant lower metric cards that repeated the right-side panel.
- Removed unnecessary `Last event`, `Active until`, and `Open alerts` cards from the mid-page because they added clutter without helping the user understand the main issue.
- Simplified the active alert card copy so it reads like a short operational summary, not a repeated explanation.

### Account Detail Content Rules

When a user clicks a business/account, the page should answer:
- Is this account healthy right now?
- What is being monitored?
- What triggered the current alert, if any?
- What was expected for this time context?
- What actually happened?
- What is the alert threshold?
- What active and past alerts exist?

Avoid:
- Generic analytics wording.
- Predictions.
- Recommendations.
- AI decision language.
- Payment-failure baseline language.
- Duplicating the same metrics in multiple places.

Preferred wording:
- Revenue chart: `Actual revenue against the historical baseline for the same day and hour.`
- Payment failure chart: `Failed payment events counted during the current 30 minutes monitoring window. RevenueWatch triggers when the fixed threshold is reached.`
- Revenue context: `same day and same hour history`.
- Payment failure context: `fixed failure threshold`, `no baseline for failures`.

### Current Chart Direction

Revenue chart should show:
- Blue current/actual revenue line.
- Light gray dashed expected baseline line.
- Red dashed alert threshold line.
- Euro values on the y-axis.
- Time labels on the x-axis.
- A visible time context label, for example `TIME CONTEXT: 09:00 UTC`.
- The threshold should not be a flat line if the expected baseline changes through the day.

Important revenue chart logic:
- The alert threshold is derived from the baseline.
- If the baseline changes by hour, the threshold should also change by hour.
- The red threshold line should therefore be a curve/line following the baseline at the configured drop percentage, not a single horizontal line.

Payment failure chart should show:
- Failure counts over the current window.
- A fixed horizontal threshold because payment failures use a fixed spike rule.
- Time range for the current 30-minute window.
- No expected-baseline line for payment failures.

Important payment failure chart logic:
- Payment failures do not use a baseline.
- It is correct for their threshold to be horizontal because the backend uses a fixed threshold.

### Recent Graph Fixes

Problem found:
- The revenue chart had three lines, but the red threshold was initially flat. This was misleading because revenue thresholds should follow the expected baseline over the day.

Fix made:
- The revenue threshold is now generated from each expected baseline point:
  - `thresholdPoint = expectedPoint * (1 - dropThreshold)`
- The chart now renders the threshold as a red dashed path, not a flat horizontal line.

Problem found after the fix:
- The chart showed a black filled area.

Cause:
- SVG paths default to `fill: black` if CSS does not explicitly set `fill: none`.

Fix made:
- Added `fill: none` to `.thresholdLine` in `page.module.css`.
- TypeScript check passed after the fix.

Verification:
- `npx.cmd tsc --noEmit` passed.

If black appears again:
- Check any SVG `<path>` used as a line and ensure the CSS has `fill: none`.
- Also hard-refresh the browser because stale CSS can remain visible during Next dev hot reload.

### Demo Data Added For Testing

Fake/demo data was added for the 10 sample businesses so the account-detail page can be tested with realistic states.

Purpose:
- Let the user review how charts and alert panels look when accounts are filled with data.
- Test both healthy and issue states.
- Keep this removable later.

Demo accounts currently include revenue points and/or payment-failure points for:
- Atlas Commerce
- Northstar Digital
- BluePeak Subscriptions
- Meridian Market
- Luma Health Co
- Forge Analytics
- Cedar Creative
- Pixel Harbor
- BrightGrowth Studio
- Nova Ops

Current demo-state intent:
- Some accounts should look normal.
- Some should show revenue drops.
- Some should show payment-failure spikes.
- The data is temporary UI test data, not production seed data.

Implementation direction:
- Demo account detail pages should use local demo monitoring data when available.
- Real connected Stripe accounts should still use real Prisma/Stripe-derived data.

### Current Calculation Rules To Preserve

Revenue drop:
- Current window: 60 minutes.
- Compare against historical behavior for the same time context.
- First compare same `dayOfWeek` and same `hourOfDay`.
- Fallback order:
  1. same day and same hour
  2. same weekday/weekend type and same hour
  3. same hour only
  4. do not evaluate if there are not enough samples
- Threshold is based on drop percentage from baseline.
- For example, if baseline is EUR 8,200 and drop threshold is 50%, alert line is EUR 4,100 for that same hour.

Payment failure spike:
- Current window: 30 minutes.
- Fixed threshold: 5 failed payments.
- No baseline.
- No comparison to "normal failures."

Hard constraints:
- Read-only.
- No money movement.
- No Stripe setting changes.
- No AI decision-making.
- No recommendations or automated actions.

### Advisor Notes For Future Work

Keep the visual chart.
- It helps users trust the alert because they can see current behavior versus expected behavior.
- But it must be accurate and readable; a misleading chart is worse than no chart.

Revenue chart must clearly explain:
- Blue = current revenue.
- Gray dashed = expected baseline.
- Red dashed = alert threshold.
- X-axis = time of day.
- Y-axis = revenue amount.
- Baseline and threshold can change by hour/day.

Payment failure chart must clearly explain:
- Bars = failed payments counted.
- Red threshold = fixed failure threshold.
- It does not use historical baseline.

If the page feels too busy:
- Remove redundant metric cards first.
- Keep the chart, right-side issue panel, and concise alert history.
- Do not add extra operational metadata unless it helps the user understand the alert.

### Known Remaining Improvements

Potential next improvements:
- Make the revenue chart line visually smoother and less jagged while keeping it truthful.
- Consider deriving real chart series from stored `RevenueMetric` data instead of demo curves.
- For real accounts, build the graph from:
  - current revenue by hour/window
  - historical matched baseline by same day/hour
  - threshold derived from baseline
- For payment failures, build the graph from failure counts in small buckets inside the 30-minute window.
- Make sure mobile layout stacks chart and issue panel cleanly.

Do not do yet without user approval:
- Remove the chart entirely.
- Add destructive alert clearing.
- Add prediction/recommendation language.
- Convert payment failure logic to a baseline-based model.

---

## Memory Update - 2026-04-26 Billing, Navbar, Dashboard, Stripe, and Recovery History

This section records the major product/app changes completed after the older landing/auth/account-detail iterations above. Keep all earlier history, but treat this section as the most recent operational memory for current app state, billing, local dev issues, and GitHub recovery points.

### Important Git Recovery Points

Recent important pushed commits on `main`:
- `b648ebf` — `Refine nav states and remove sample dashboard data`
- `93bc231` — `Separate marketing and app nav states`
- `5698dac` — `Add plan gating for Stripe account limits`
- `61a45fc` — `Refine billing page and add local billing preview`
- `8176136` — `Add Stripe Checkout billing routes`
- `e2736aa` — `Handle Stripe customer mode mismatch`
- `034a93c` — `Separate Stripe customer IDs by mode`

Important workflow behavior:
- The user frequently asks to revert to the last GitHub push if a direction feels wrong.
- When the user says "go back to the last github push", the repo should be aligned to `origin/main`, not partially reverted.
- Database/demo data changes are not recoverable via Git unless a seed/reset script exists.

### Dashboard and App Shell Direction

The dashboard and app shell have been deliberately moved away from "marketing site inside the app" and toward a focused SaaS product shell.

Accepted app-shell decisions:
- Logged-out navbar and logged-in navbar are intentionally different.
- Logged-out navbar:
  - left: `RevenueWatch`
  - center: `How it Works`, `Pricing`, `Support`
  - right: `Sign in`, `Get started`
- Logged-in navbar:
  - left: `RevenueWatch`
  - center: `Dashboard`, `Accounts`, `Alerts`
  - right: avatar, user name, dropdown arrow
  - dropdown includes app actions like `Settings`, `Billing`, `Sign out`
- Logged-in navbar should be slightly smaller/tighter than marketing navbar.
- Active logged-in nav item should be clearly visible:
  - darker text
  - slightly bolder
  - subtle underline

Dashboard/footer product-shell decisions:
- Remove the full marketing footer from dashboard/app pages.
- App pages should feel like product surfaces, not public site sections.
- Dashboard/footer spacing should remain quiet and minimal.

### Dashboard Layout Decisions

The dashboard was refactored away from a left/right split into a clearer vertical product flow.

Accepted dashboard order:
1. System status
2. Accounts needing attention
3. Active alerts
4. Connected accounts
5. Recent history

Dashboard UX rules accepted:
- User should scan top to bottom, not left to right.
- Empty states should be simple and calm.
- Empty states eventually received subtle low-contrast containers instead of large heavy boxes.
- Connected account cards should feel clickable.
- `Unnamed account` fallback was replaced with `Stripe account`.
- The `LIVE` badge was removed from the top status area in later refinement requests, but some older screenshots/branches may still show it depending on revert state.
- Recent History can be hidden or visually softened when empty.

Important dashboard copy decisions:
- Top description simplified to:
  - `Monitoring 1 Stripe account. No issues detected.`
- Empty-state copy simplified to:
  - `No accounts need attention`
  - `No active alerts`

Important current behavior:
- Dashboard `Add Account` remains the main action for connecting Stripe accounts.
- A temporary local-only `Billing Preview` shortcut was added during billing work so the user could inspect `/billing` locally without triggering Stripe Connect.
- This local preview button exists only as a dev convenience and should not be treated as a permanent product requirement.

### Demo/Test Dashboard Data History

This changed multiple times and must be remembered clearly.

What happened:
- Temporary sample businesses and alerts were removed from code so the dashboard reflected real DB state.
- Later, demo companies and alerts were seeded directly into the database for UI review.
- A reusable seed script was created temporarily:
  - `scripts/seed-demo-dashboard.cjs`
- Seeded companies included realistic names such as:
  - Atlas Commerce
  - Northstar Digital
  - BluePeak Subscriptions
  - Meridian Market
  - Oak & Ember
  - Lumen Studio
  - Harbor House Goods
  - Riverline Fitness
  - Cedar & Co
  - Summit Learn

Seeded alert intent:
- Some accounts should show revenue drops.
- Some should show payment failure spikes.
- Some should remain healthy.

Important nuance:
- Seeded active alerts can "disappear" from the dashboard when their alert windows expire, even though alert records still exist in the DB.
- This caused confusion because the user expected issues to remain active.
- The fix during testing was to refresh demo timestamps or reseed active alerts.

Current rule:
- Demo/sample data is acceptable for testing, but the user may ask to remove it at any time.
- When the user says "remove the data in the dashboard", they mean delete the seeded demo companies/alerts from the DB, not just hide them in UI.

### Account Management Direction That Was Explored Then Reverted

Several account-management ideas were implemented and then intentionally rolled back after the user disliked the direction.

Explored features:
- Pause monitoring / resume monitoring
- Remove account
- Account management controls in the account detail header
- Soft removal via account `status`

Outcome:
- Those directions were not kept as the final preferred path at that time.
- The user explicitly asked to revert to the last GitHub push more than once.
- Future chats should not assume those account-management controls are still desired unless they still exist in the current checked-out code.

### Billing and Plan-Limit Product Direction

This is now a major current product direction and should be treated as intentional.

Agreed billing/product flow:
1. User signs in first.
2. User starts on Free by default.
3. Free plan allows 1 connected Stripe account.
4. If user tries to connect more than their plan allows, RevenueWatch blocks the Stripe Connect flow and sends them to Billing.
5. Billing is an in-app upgrade page, not a marketing pricing page.
6. Stripe Checkout handles subscription purchase.
7. Stripe webhooks update plan/subscription state.
8. Later, Stripe Customer Portal can be used for subscription management.

Plan limits agreed:
- `FREE` = 1 active connected Stripe account
- `GROWTH` = 10 active connected Stripe accounts
- `PRO` = 25 active connected Stripe accounts

Important plan-limit rule:
- Count only active connected Stripe accounts.
- Do not count disconnected/paused accounts.

### Billing Placeholder Page Direction

The billing page was rebuilt to feel like a real in-app upgrade gate rather than an internal placeholder.

Current billing page principles:
- In-app billing/settings feel, not a landing-page pricing table.
- Calm, product-like, Stitch-inspired card layout.
- Show current plan clearly.
- Show account usage clearly.
- Show Growth and Pro upgrade cards.
- Avoid internal product-explanation text on the page.
- Both upgrade buttons should look actionable.

Accepted billing page content decisions:
- Show a top message like:
  - `You've reached your limit of 1 connected Stripe account. Upgrade to monitor more accounts.`
- Current plan card simplified to:
  - `Current plan: Free`
  - `1 / 1 accounts used`
- Remove internal placeholder text like:
  - `RevenueWatch keeps billing separate from monitoring...`
  - `Stripe Checkout comes next`
- Add trust line:
  - `You can upgrade or cancel anytime. No changes are made to your Stripe accounts.`

Stitch guidance:
- The user shared a Stitch export and explicitly wanted the billing page to follow the Stitch layout more closely.
- Billing page was adjusted to feel more like the Stitch design while remaining product-like.

### Billing Implementation State

Core files involved:
- `src/lib/billing.ts`
- `src/app/billing/page.tsx`
- `src/app/billing/page.module.css`
- `src/app/api/stripe/connect/route.ts`
- `src/app/api/billing/checkout/growth/route.ts`
- `src/app/api/billing/checkout/pro/route.ts`
- `src/lib/stripe-customer.ts`
- `src/app/api/stripe/webhook/route.ts`

Current billing helper state:
- `src/lib/billing.ts` provides:
  - plan labels
  - plan limits
  - `getPlanLimit`
  - `getPlanLabel`

Billing page state:
- Reads `user.plan` from Prisma.
- Reads active connected Stripe accounts from Prisma.
- Calculates usage and plan limit from DB state.
- Supports billing notices like:
  - `reason=limit_reached`
  - `billing=cancelled`
  - `billing=customer_error`

### Stripe Connect Plan Gating

Current implementation:
- File: `src/app/api/stripe/connect/route.ts`
- Behavior:
  - authenticates user
  - loads `user.plan`
  - counts active Stripe accounts
  - compares against plan limit
  - redirects to `/billing?reason=limit_reached` when limit is reached
  - otherwise continues to Stripe OAuth

Important nuance:
- The gating is implemented before redirecting to Stripe Connect.
- The user repeatedly confirmed this behavior and asked for confirmation checks.

Current Connect OAuth redirect behavior:
- Code builds redirect URI from:
  - `${NEXT_PUBLIC_APP_URL}/api/stripe/callback`
- Important Stripe dashboard configuration:
  - The OAuth redirect URIs in Stripe must exactly match:
    - `http://localhost:3000/api/stripe/callback`
    - `https://revenuewatch.app/api/stripe/callback`
- The user at one point configured:
  - `/api/stripe/connect/callback`
  - and `www.revenuewatch.app`
  which did **not** match the current app code.

Important reminder:
- Stripe requires exact redirect URI matches.
- If Stripe dashboard uses `/api/stripe/connect/callback` but the app uses `/api/stripe/callback`, Stripe Connect will fail.

### Stripe Checkout Implementation State

Current checkout routes:
- `/api/billing/checkout/growth`
- `/api/billing/checkout/pro`

Current route behavior:
- Require a logged-in user.
- Load the user from Prisma.
- Ensure a Stripe customer exists.
- Create a Stripe Checkout Session with `mode: "subscription"`.
- Use environment variables:
  - `STRIPE_GROWTH_PRICE_ID`
  - `STRIPE_PRO_PRICE_ID`
- Use:
  - `success_url = ${NEXT_PUBLIC_APP_URL}/dashboard?billing=success`
  - `cancel_url = ${NEXT_PUBLIC_APP_URL}/billing?billing=cancelled`
- Include metadata:
  - `userId`
  - `plan`

Important checkout metadata rule:
- `userId` is included in top-level session metadata.
- `userId` and `plan` are also included in `subscription_data.metadata`.
- This is critical because webhook fulfillment depends on it.

### Stripe Customer ID Mode Separation

This became necessary because the same logged-in user is used locally with `sk_test_...` and in production with `sk_live_...`.

Problem:
- A single `stripeCustomerId` field is not sufficient.
- A test customer ID can be accidentally reused in live mode, or vice versa.
- That causes Stripe errors like:
  - `No such customer; a similar object exists in live mode, but a test mode key was used.`

Implemented solution:
- Keep legacy:
  - `stripeCustomerId`
- Add:
  - `stripeTestCustomerId`
  - `stripeLiveCustomerId`

Current mode-aware customer logic:
- File: `src/lib/stripe-customer.ts`
- Detect Stripe mode from `STRIPE_SECRET_KEY`:
  - `sk_test_...` => use `stripeTestCustomerId`
  - `sk_live_...` => use `stripeLiveCustomerId`
- Candidate lookup order:
  1. mode-specific customer field
  2. legacy `stripeCustomerId` (compatibility fallback)
- Try `stripe.customers.retrieve(customerId)`
- If Stripe says `resource_missing` or the customer is deleted:
  - create a new customer
  - save it to the correct mode-specific field
- Unexpected errors redirect to:
  - `/billing?billing=customer_error`

Migration added:
- `20260426200000_add_mode_specific_customer_ids`

Pushed commit:
- `034a93c` — `Separate Stripe customer IDs by mode`

### Stripe/Webhook and Subscription Fulfillment State

This is the most important current area because it is still being actively debugged.

What was true before the latest webhook work:
- Payment could succeed in Stripe Checkout.
- User remained on `FREE`.
- `Add Account` still redirected to Billing.
- Root cause: webhook fulfillment was missing or incomplete, so the database plan was never updated.

Webhook file:
- `src/app/api/stripe/webhook/route.ts`

Existing webhook responsibilities before billing changes:
- Verify Stripe webhook signature using raw body and `STRIPE_WEBHOOK_SECRET`.
- Process Connect/payment events for RevenueWatch monitoring.
- Create `StripeEvent` audit records.
- Trigger revenue-drop and payment-failure alerts.

Important current webhook design rule:
- The webhook serves **both**:
  - RevenueWatch monitoring alerts (Connect/payment events)
  - Billing fulfillment (Checkout/subscription events)

Important implementation detail:
- `checkout.session.completed` must be handled **before** the Connect-specific `event.account` logic.
- Checkout events may not include `event.account`.
- If code assumes every webhook event is a Connect event first, billing fulfillment will silently fail or return early.

Current billing-related webhook work:
- `checkout.session.completed` handler was added.
- It:
  - reads `session.metadata.userId`
  - reads `session.metadata.plan`
  - falls back to finding the user by Stripe customer ID if metadata is missing
  - updates:
    - `plan`
    - `stripeCustomerId`
    - correct mode-specific customer field
    - `stripeSubscriptionId`
- Console logging was added for billing webhook visibility.

Planned/implemented extension:
- Add `subscriptionStatus` to `User`.
- Handle:
  - `customer.subscription.updated`
  - `invoice.paid`
- Update user subscription state from those events.

Current migration for this:
- `20260426213000_add_subscription_status`

Current local status of this work:
- `subscriptionStatus` was added to Prisma schema locally.
- The migration was created and applied to the database.
- Webhook code was updated locally to handle:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `invoice.paid`
- `npx prisma migrate deploy` was run successfully for `subscriptionStatus`.
- However, this latest `subscriptionStatus` webhook work was still **local/unpushed** at the time of this memory update.
- Because the dev server was holding Prisma DLLs open, Prisma client regeneration was blocked until the user stops `next dev`.

Current local unpushed files (at memory update time):
- `prisma/schema.prisma`
- `prisma/migrations/20260426213000_add_subscription_status/migration.sql`
- `src/app/api/stripe/webhook/route.ts`
- `src/lib/stripe-customer.ts` may also have local export changes depending on the exact working tree state

Important current local step after editing Prisma schema:
- Stop dev server
- Run:
  - `npx prisma generate`
  - `npm run dev`

Without this, TypeScript or runtime can complain that new Prisma fields do not exist.

### Stripe CLI and Local Webhook Debugging

Very important local-dev lessons:

1. Stripe CLI can fail with expired API key
- Error seen:
  - `api_key_expired`
  - `Expired API Key provided`
- Meaning:
  - local Stripe test key used by CLI was expired
- Fix:
  - create/reveal a fresh test secret key in Stripe Dashboard
  - update local `.env`
  - optionally `stripe logout` and `stripe login`

2. `STRIPE_WEBHOOK_SECRET` from `stripe listen` is session-specific
- Every time `stripe listen --forward-to localhost:3000/api/stripe/webhook` is restarted, a new `whsec_...` may be issued.
- If `.env` still contains an old `whsec_...`, webhook verification fails silently from the user’s point of view and the plan will remain `FREE`.

3. Changing webhook secret after payment does not fix old missed events
- If checkout already completed while the wrong secret/listener was active, the user record will not update retroactively.
- To recover, either:
  - replay the event
  - run a new checkout
  - or manually update the user in DB for testing

4. Payment success does not update the app by itself
- Success URL is **not** the source of truth.
- Only the webhook should update:
  - plan
  - subscription/customer IDs
  - subscription status

### Production/Vercel Billing Environment Notes

Production failures encountered:
- Missing `STRIPE_GROWTH_PRICE_ID` in Vercel caused raw JSON error:
  - `{"error":"Missing STRIPE_GROWTH_PRICE_ID"}`
- Fix:
  - add env vars in Vercel
  - redeploy

Another production/local issue:
- Using a live-mode price with a test secret key caused:
  - `No such price ... a similar object exists in live mode, but a test mode key was used`
- Meaning:
  - price IDs must match the mode/account of the Stripe secret key
- Rule:
  - `sk_test_...` must use test-mode price IDs
  - `sk_live_...` must use live-mode price IDs

### Prisma/Windows Local Dev Gotchas

Important recurring issue on Windows:
- `npx prisma generate` can fail because `query_engine-windows.dll.node` is locked while `next dev` is running.
- Error patterns:
  - rename EPERM
  - locked `.dll.node`

Correct fix:
- Stop `next dev`
- Run:
  - `npx prisma generate`
  - `npx prisma migrate deploy` if needed
- Start `npm run dev` again

Do not use:
- `npx prisma generate --no-engine`
for this project

Reason:
- It previously caused Prisma to behave like Data Proxy/Accelerate mode and produced confusing errors such as:
  - datasource URL must start with `prisma://`

### Prisma/Auth Mismatch History

This repo hit several schema/client mismatch issues:

Examples:
- `User.plan` missing from generated client
- `User.stripeCustomerId` missing from DB/client
- `User.stripeTestCustomerId` missing from DB
- `subscriptionStatus` added locally but Prisma client regeneration blocked by running dev server

Important lesson:
- When schema changes are made:
  1. apply migration
  2. regenerate Prisma client
  3. restart dev server

Auth.js impact:
- Because Auth.js loads `User` via Prisma during login/session/account lookup, missing DB columns can break:
  - navbar rendering
  - login
  - callback
  - session lookup
even if the bug is "really" a billing schema change

### Billing Problem Diagnosis Rule

If the user says:
- payment succeeded
- billing page still says `Current plan: Free`
- add-account still sends them to billing

Then assume:
- `User.plan` in the database is still `FREE`
- webhook fulfillment did not update the row

The correct debugging order is:
1. Confirm checkout route includes metadata `userId` and `plan`
2. Confirm webhook listener is running
3. Confirm `STRIPE_WEBHOOK_SECRET` matches current `stripe listen`
4. Confirm webhook logs show:
   - `Checkout session completed webhook received`
   - `Updated user plan from checkout webhook`
5. Confirm user row in DB changed
6. Only then test `Add Account` again

### Current Product/Code Truth At End Of This Memory Update

Pushed billing/product state:
- Plan gating exists before Stripe Connect.
- Billing page exists and reads plan from DB.
- Checkout routes for Growth/Pro exist.
- Mode-specific Stripe customer ID handling exists.
- GitHub `main` includes those billing foundations.

Current local in-progress state:
- Billing webhook fulfillment is being extended so successful Stripe subscription payments actually upgrade the user in Prisma.
- `subscriptionStatus` has been added locally and migrated in the DB.
- Final local step still needed after schema change:
  - stop dev server
  - `npx prisma generate`
  - restart app

Do not forget:
- The user wants future chats to remember all of this.
- Do not delete old memory sections when updating this file.
- Append new dated sections instead.
