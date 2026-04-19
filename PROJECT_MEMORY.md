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
