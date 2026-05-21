# Subscription Health Monitoring

## Overview

Parveil monitors subscription health before revenue problems grow.

The current monitoring backbone starts with Stripe-connected accounts. It is monitoring-only:

- no Stripe writes
- no subscription changes
- no money movement
- no customer emails from the subscription-health engine

The purpose of this backbone is to store subscription health data, evaluate trends, and create internal alerts that can later support stronger UX and notification flows.

## Subscription Health Metrics

The current snapshot model tracks these metrics for each connected Stripe account:

### `activeSubscriptions`

Count of subscriptions currently in Stripe `active` status.

### `trialingSubscriptions`

Count of subscriptions currently in Stripe `trialing` status.

### `pastDueSubscriptions`

Count of subscriptions currently in Stripe `past_due` status.

### `unpaidSubscriptions`

Count of subscriptions currently in Stripe `unpaid` status.

### `canceledSubscriptions`

Count of subscriptions currently in Stripe `canceled` status.

### `failedRenewalPayments`

Count of subscription-related `invoice.payment_failed` events in the current monitoring window.

This is derived from subscription health events, not directly from the subscription table.

### `estimatedMonthlyRevenue`

Estimated MRR in minor currency units, based on active paid subscriptions only.

Examples:

- `3900` EUR cents = `€39`
- `1000` EUR cents = `€10`

### `netSubscriptionMovement`

Calculated as:

`newSubscriptions - cancellations`

This is snapshot-window movement, not lifetime movement.

## Estimated MRR Rules

Estimated MRR is intentionally conservative right now.

Current rules:

- only `active` subscriptions count
- `trialing` does not count
- `past_due` does not count
- `unpaid` does not count
- `canceled` does not count

Recurring normalization rules:

- monthly subscriptions count directly
- yearly subscriptions are divided by `12`
- `interval_count` is handled
  - example: every `3` months is spread across monthly value
- `quantity` is multiplied into the total
- multi-item subscriptions are summed across all items

Examples:

- `€39/month`, quantity `1` => `€39` estimated MRR
- `€39/month`, quantity `3` => `€117` estimated MRR
- `€120/year` => about `€10/month`
- multi-item subscription:
  - item A = `€39/month`
  - item B = `€10/month`
  - total estimated MRR = `€49/month`

## Alert Types and Logic

Current subscription-health alert types:

### `subscription_canceled`

Purpose:

- created when a connected-account subscription is canceled

Current trigger paths:

- connected-account `customer.subscription.deleted` webhook
- subscription backfill when a canceled subscription is discovered

Severity:

- `warning`

Example message:

- `A customer canceled a subscription. Estimated monthly revenue impact: €39.`

Deduplication key pattern:

- `subscription_canceled:${stripeSubscriptionId}:${canceledAt}`

### `failed_renewal`

Purpose:

- created when a connected-account subscription renewal payment fails

Current trigger paths:

- connected-account `invoice.payment_failed` webhook when tied to a subscription
- dev helper route for local testing

Severity:

- `warning`

Example message:

- `A subscription renewal payment failed. Amount at risk: €39.`

Deduplication key pattern:

- preferred: `failed_renewal:${stripeInvoiceId}`
- fallback: `failed_renewal:${stripeSubscriptionId}`

### `subscription_drop`

Purpose:

- created when active subscriptions drop meaningfully compared with the previous snapshot

Current trigger logic:

- compare latest snapshot to the immediately previous snapshot for the same Stripe account
- only evaluate if previous `activeSubscriptions >= 5`
- create alert if active subscriptions dropped by at least `20%`

Example:

- previous active = `10`
- current active = `7`
- drop = `30%`

Severity:

- `warning`

Example message:

- `Active subscriptions dropped from 10 to 7.`

Deduplication key pattern:

- `subscription_drop:${stripeAccountId}:${currentSnapshotKey}`

### `cancellation_spike`

Purpose:

- created when cancellations are unusually high

Current trigger logic:

- compare latest snapshot to the immediately previous snapshot
- only alert if current `cancellations >= 3`
- alert if:
  - current cancellations are at least `2x` baseline, or
  - no baseline exists and current cancellations are at least `5`

Severity:

- `warning`

Example messages:

- `Cancellations increased from 2 to 5.`
- `Cancellations are higher than usual: 5 cancellations in the recent window.`

Deduplication key pattern:

- `cancellation_spike:${stripeAccountId}:${currentSnapshotKey}`

### `past_due_increase`

Purpose:

- created when the number of past-due subscriptions increases materially

Current trigger logic:

- compare latest snapshot to previous snapshot
- only evaluate if current `pastDueSubscriptions >= 1`
- alert if:
  - previous past due was `0` and current is at least `1`, or
  - current past due increased by at least `2`, or
  - current past due is at least `2x` previous past due

Severity:

- `warning`

Example messages:

- `Past-due subscriptions increased from 0 to 1.`
- `Past-due subscriptions increased from 2 to 5.`

Deduplication key pattern:

- `past_due_increase:${stripeAccountId}:${currentSnapshotKey}`

### `unpaid_subscription`

Purpose:

- created when subscriptions are currently in `unpaid` state

Current trigger logic:

- alert if current `unpaidSubscriptions >= 1`

Severity:

- `warning`

Example messages:

- `1 subscription is marked unpaid.`
- `3 subscriptions are marked unpaid.`

Deduplication key pattern:

- `unpaid_subscription:${stripeAccountId}:${currentSnapshotKey}`

## Snapshot and Trend Logic

Subscription health snapshots are the backbone for trend evaluation.

Current behavior:

- raw subscription state is stored in `SubscriptionHealthSubscription`
- normalized subscription/invoice signals are stored in `SubscriptionHealthEvent`
- account-level state is summarized into `SubscriptionHealthSnapshot`

Trend alerts compare:

- latest snapshot
- previous snapshot for the same Stripe account

The evaluator currently runs after snapshot sync so webhook, backfill, and dev-seed flows can share the same monitoring path.

## Dev and Testing Helpers

Current dev-only routes:

- `/api/internal/dev/create-failed-renewal-test-alert`
- `/api/internal/dev/seed-subscription-health-test-state`

### `/api/internal/dev/create-failed-renewal-test-alert`

Purpose:

- create a local `failed_renewal` alert and matching subscription-health event without calling Stripe

Suggested input:

- `stripeAccountId`
- `amountDue`
- `currency`
- optional `testId`

### `/api/internal/dev/seed-subscription-health-test-state`

Purpose:

- seed local subscription-health state for a connected Stripe account so the dashboard and alert logic can be tested without modifying Stripe

Available scenarios:

- `basic-active`
- `multiple-active`
- `mixed-health`
- `yearly-active`
- `quantity-active`
- `mixed-mrr`
- `trend-subscription-drop`
- `trend-cancellation-spike`
- `trend-past-due-increase`
- `trend-unpaid-subscription`
- `empty`

Scenario notes:

- `yearly-active`
  - verifies yearly-to-monthly MRR normalization
- `quantity-active`
  - verifies quantity-based MRR math
- `mixed-mrr`
  - verifies that only active paid subscriptions count toward MRR
- trend scenarios
  - create synthetic snapshot progression for alert testing
- `empty`
  - clears dev-seeded subscription-health rows and dev-created alerts for that account
  - restores the account to the real local state remaining in the database

## Production Safety

Current safety rules for dev helper routes:

- they return `404` in production
- they require a signed-in user locally
- they verify the connected Stripe account belongs to the signed-in user
- they do not call Stripe
- they do not send customer emails
- they do not send owner emails

This makes them suitable for local monitoring-engine QA without opening a production backdoor.

## Known Future Improvements

- real Stripe failed-renewal webhook testing with Stripe Test Clocks
- smarter alert severity rules
- cooldown and notification rules before owner emails are enabled
- richer UX once the monitoring backbone is stable
- possible future billing-platform expansion only after Stripe subscription health is validated
