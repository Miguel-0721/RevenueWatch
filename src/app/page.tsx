import Link from "next/link";
import Navbar from "@/components/Navbar";
import MarketingFooter from "@/components/MarketingFooter";
import RevenueWatchLogo from "@/components/RevenueWatchLogo";
import ScrollReveal from "@/components/ScrollReveal";
import StitchIcon from "@/components/StitchIcon";
import type { IconName } from "@/components/StitchIcon";
import styles from "./page.module.css";

const FAQ_ITEMS = [
  {
    question: "Does RevenueWatch move money or change my Stripe account?",
    answer:
      "No. RevenueWatch is monitoring-only. It reads Stripe activity so it can detect revenue drops and payment failure spikes. It does not move money, issue refunds, create charges, or change your Stripe settings.",
  },
  {
    question: "Why does RevenueWatch need Stripe access?",
    answer:
      "RevenueWatch needs access to read payment activity from your connected Stripe account. That is how it checks if revenue is lower than usual or if payment failures are increasing.",
  },
  {
    question: "What happens after I connect Stripe?",
    answer:
      "RevenueWatch starts monitoring the connected account and imports recent Stripe activity where available. This helps build a baseline faster, so graphs and alerts can become useful sooner.",
  },
  {
    question: "Does RevenueWatch work for new or low-volume Stripe accounts?",
    answer:
      "Yes, but revenue-drop alerts work best when the account has regular payment activity. New or low-volume accounts may need time to build a reliable baseline before revenue-drop thresholds appear.",
  },
  {
    question: "Will I get alerts for every small change?",
    answer:
      "No. RevenueWatch is intentionally conservative. It is built to avoid noisy alerts and only flag changes that look meaningfully different from recent normal activity.",
  },
  {
    question: "What alerts does RevenueWatch support?",
    answer:
      "RevenueWatch currently focuses on two alert types: revenue drops and payment failure spikes.",
  },
  {
    question: "Can I disconnect Stripe?",
    answer:
      "Yes. You can disconnect a Stripe account at any time. Disconnecting pauses monitoring for that account. It does not delete your Stripe account or change anything in Stripe.",
  },
  {
    question: "Does RevenueWatch predict future revenue?",
    answer:
      "No. RevenueWatch does not predict the future or recommend what to do. It only monitors Stripe activity and alerts you when something looks unusually different from recent normal patterns.",
  },
];

function HeroWidget() {
  return (
    <div className={styles.heroWidgetWrap}>
      <div className={styles.heroDashboardPreview}>
        <RevenueMonitoringPreview hero />
      </div>
    </div>
  );
}

function TrustCard({
  icon,
  title,
  body,
}: {
  icon: IconName;
  title: string;
  body: string;
}) {
  return (
    <article className={styles.trustCard}>
      <div className={styles.trustIconWrap}>
        <StitchIcon name={icon} className={styles.trustIcon} />
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

function InsightCard({
  icon,
  title,
  body,
}: {
  icon: IconName;
  title: string;
  body: string;
}) {
  return (
    <article className={styles.insightCard}>
      <div className={styles.insightIconWrap}>
        <StitchIcon name={icon} className={styles.insightIcon} />
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

function ValueWidget({
  icon,
  label,
  metric,
  title,
  body,
  variant,
}: {
  icon: IconName;
  label: string;
  metric: string;
  title: string;
  body: string;
  variant: "revenue" | "time" | "trust";
}) {
  return (
    <article className={styles.valueWidget}>
      <div className={`${styles.valueVisual} ${styles[`valueVisual${variant[0].toUpperCase()}${variant.slice(1)}`]}`}>
        {variant === "revenue" ? (
          <>
            <div className={styles.valueBars} aria-hidden="true">
              <span className={styles.barOne} />
              <span className={styles.barTwo} />
              <span className={styles.barThree} />
              <span className={styles.barFour} />
              <span className={styles.barFive} />
            </div>
            <div className={styles.valueVisualMeta}>
              <span>{label}</span>
              <strong>{metric}</strong>
            </div>
          </>
        ) : null}

        {variant === "time" ? (
          <>
            <div className={styles.valueDial} aria-hidden="true">
              <div className={styles.valueDialInner}>
                <StitchIcon name={icon} className={styles.valueDialIcon} />
              </div>
            </div>
            <div className={styles.valueVisualMetaCenter}>
              <span>{label}</span>
              <strong>{metric}</strong>
            </div>
          </>
        ) : null}

        {variant === "trust" ? (
          <>
            <div className={styles.valueTrustStack} aria-hidden="true">
              <div className={styles.valueTrustCard}>
                <div className={styles.valueTrustAvatar}>
                  <StitchIcon name="thumb_up" className={styles.valueTrustIcon} />
                </div>
                <div className={styles.valueTrustLines}>
                  <span />
                  <span />
                </div>
              </div>
              <div className={`${styles.valueTrustCard} ${styles.valueTrustCardOffset}`}>
                <div className={styles.valueTrustAvatar}>
                  <StitchIcon name="forum" className={styles.valueTrustIcon} />
                </div>
                <div className={styles.valueTrustLines}>
                  <span />
                  <span />
                </div>
              </div>
            </div>
            <div className={styles.valueVisualMetaCenter}>
              <span>{label}</span>
              <strong>{metric}</strong>
            </div>
          </>
        ) : null}
      </div>

      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

function PricingCard({
  tier,
  description,
  price,
  suffix,
  items,
  cta,
  featured = false,
}: {
  tier: string;
  description: string;
  price: string;
  suffix?: string;
  items: string[];
  cta: string;
  featured?: boolean;
}) {
  return (
    <article className={`${styles.pricingCard} ${featured ? styles.pricingFeatured : ""}`}>
      {featured ? <span className={styles.popularBadge}>Most Popular</span> : null}

      <p className={`${styles.tierLabel} ${featured ? styles.tierFeatured : ""}`}>{tier}</p>
      <p className={styles.tierDescription}>{description}</p>

      <div className={styles.priceRow}>
        <span>{price}</span>
        {suffix ? <small>{suffix}</small> : null}
      </div>

      <ul className={styles.pricingList}>
        {items.map((item) => (
          <li key={item}>
            <StitchIcon
              name="check_circle"
              filled={featured}
              className={styles.checkIcon}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <Link
        href={
          tier === "Pro"
            ? "/api/billing/checkout/pro"
            : tier === "Growth"
              ? "/auth/continue?plan=growth"
              : "/auth/continue?plan=free"
        }
        className={featured ? styles.primaryAction : styles.secondaryAction}
      >
        {cta}
      </Link>
    </article>
  );
}

function FAQCard({ question, answer }: { question: string; answer: string }) {
  return (
    <article className={styles.faqCard}>
      <div className={styles.faqIconWrap}>
        <StitchIcon name="verified" className={styles.faqIcon} />
      </div>
      <div>
        <h3>{question}</h3>
        <p>{answer}</p>
      </div>
    </article>
  );
}

function RevenueMonitoringPreview({ hero = false }: { hero?: boolean }) {
  return (
    <div className={`${styles.monitorPreviewCard} ${hero ? styles.monitorPreviewCardHero : ""}`}>
      <div className={styles.monitorPreviewHeader}>
        <div>
          <p className={styles.monitorPreviewEyebrow}>Connected account</p>
          <h4>Northstar Commerce</h4>
        </div>
        <span className={styles.monitorPreviewAlertPill}>Revenue drop detected</span>
        </div>

        <div className={styles.monitorPreviewBody}>
        <div className={styles.monitorPreviewIssue}>
          <p className={styles.monitorPreviewEyebrow}>Current issue</p>
          <strong>Sales are much lower than usual for this period.</strong>
          <span>{hero ? "Alert snapshot" : "High severity"}</span>
        </div>

        <div className={styles.monitorPreviewChart}>
          <svg viewBox="0 0 360 170" className={styles.monitorPreviewSvg} aria-hidden="true">
            <defs>
              <linearGradient id="monitorRevenueFill" x1="0%" x2="0%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="#0058bc" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#0058bc" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="monitorRevenueAlertZone" x1="0%" x2="0%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="#ba1a1a" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#ba1a1a" stopOpacity="0.015" />
              </linearGradient>
            </defs>

            <g stroke="#e2e8f0" strokeWidth="1">
              <line x1="22" y1="28" x2="338" y2="28" />
              <line x1="22" y1="72" x2="338" y2="72" />
              <line x1="22" y1="116" x2="338" y2="116" />
              <line x1="22" y1="150" x2="338" y2="150" />
            </g>

            <rect x="22" y="92" width="316" height="58" fill="url(#monitorRevenueAlertZone)" />

            <line
              x1="22"
              x2="338"
              y1="92"
              y2="92"
              stroke="#ba1a1a"
              strokeDasharray="6 5"
              strokeWidth="1.5"
            />

            <path
              d="M22 54 L98 48 L174 52 L250 56 L326 120 L326 150 L22 150 Z"
              fill="url(#monitorRevenueFill)"
            />
            <path
              d="M22 54 L98 48 L174 52 L250 56 L326 120"
              fill="none"
              stroke="#0058bc"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.25"
            />
            <circle cx="326" cy="120" r="4.5" fill="#ba1a1a" />

            <g className={styles.monitorPreviewAxis}>
              <text x="22" y="164">07:00</text>
              <text x="98" y="164" textAnchor="middle">08:00</text>
              <text x="174" y="164" textAnchor="middle">09:00</text>
              <text x="250" y="164" textAnchor="middle">10:00</text>
              <text x="338" y="164" textAnchor="end">11:00</text>
            </g>
          </svg>

          <div className={styles.monitorPreviewThreshold}>Threshold (€75,000)</div>
        </div>

        <div className={styles.monitorPreviewMetrics}>
          <div className={styles.monitorPreviewMetricCritical}>
            <span>Current revenue</span>
            <strong>€53,000</strong>
          </div>
          <div>
            <span>Usual revenue</span>
            <strong>€112,000</strong>
          </div>
          <div>
            <span>Alert threshold</span>
            <strong>€75,000</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

function FailureMonitoringPreview() {
  return (
    <div className={styles.monitorPreviewCard}>
      <div className={styles.monitorPreviewHeader}>
        <div>
          <p className={styles.monitorPreviewEyebrow}>Connected account</p>
          <h4>BluePeak Studio</h4>
        </div>
        <span className={styles.monitorPreviewAlertPillWarning}>Payment failure spike</span>
      </div>

      <div className={styles.monitorPreviewBody}>
        <div className={styles.monitorPreviewIssue}>
          <p className={styles.monitorPreviewEyebrow}>Current issue</p>
          <strong>Payment failures are significantly higher than usual.</strong>
          <span>Review in real time before customers notice.</span>
        </div>

        <div className={styles.monitorPreviewBars}>
          <div className={styles.monitorPreviewThresholdBar}>Threshold: 12</div>
          <div className={styles.monitorPreviewBarChart} aria-hidden="true">
            <span style={{ height: "24%" }} />
            <span style={{ height: "48%" }} />
            <span style={{ height: "35%" }} />
            <span style={{ height: "56%" }} />
            <span style={{ height: "18%" }} />
            <span className={styles.monitorPreviewBarCritical} style={{ height: "88%" }} />
          </div>
          <div className={styles.monitorPreviewBarLabels}>
            <span>10:00</span>
            <span>11:00</span>
            <span>12:00</span>
            <span>13:00</span>
            <span>14:00</span>
            <span>15:00</span>
          </div>
        </div>

        <div className={styles.monitorPreviewMetrics}>
          <div>
            <span>Current failed payments</span>
            <strong>14</strong>
          </div>
          <div>
            <span>Usual failed payments</span>
            <strong>6</strong>
          </div>
          <div>
            <span>Alert threshold</span>
            <strong>12</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <Navbar mode="marketing" />
      <main className={styles.page}>
      <section className={styles.heroSection}>
        <div className={styles.heroShell}>
          <div className={styles.heroGrid}>
            <ScrollReveal className={styles.heroCopy}>
              <span className={styles.partnerBadge}>
                <StitchIcon name="verified" filled className={styles.partnerIcon} />
                Stripe account monitoring
              </span>

              <h1>
                Catch <span>payment failures</span> and <span>revenue drops</span>{" "}
                before your clients do.
              </h1>

              <p>
                RevenueWatch monitors your Stripe accounts in the background and
                alerts you when payment failures or unusual revenue drops need
                attention, before they become client-facing problems.
              </p>

              <div className={styles.heroTrustLine}>
                <span>Read-only access.</span>
                <span>No money movement.</span>
                <span>Monitoring only.</span>
              </div>

              <div className={styles.heroActions}>
                <Link href="/login" className={styles.primaryAction}>
                  Start monitoring
                  <StitchIcon name="arrow_forward" className={styles.arrowIcon} />
                </Link>

                <a href="#how-it-works" className={styles.secondaryAction}>
                  How it works
                </a>
              </div>
            </ScrollReveal>

            <ScrollReveal delayMs={120}>
              <HeroWidget />
            </ScrollReveal>
          </div>
        </div>
      </section>

      <section className={styles.insightSection}>
        <div className={styles.shell}>
          <ScrollReveal className={styles.centerHeading}>
            <h2>What happens without RevenueWatch?</h2>
            <p>
              Stripe issues can sit quietly until they cost you revenue, time,
              or client trust.
            </p>
          </ScrollReveal>

          <div className={styles.insightGrid}>
            <ScrollReveal delayMs={40}>
              <InsightCard
                icon="warning"
                title="Payment failures go unnoticed"
                body="Failed payments can reduce revenue quietly, especially when no one is checking Stripe closely."
              />
            </ScrollReveal>
            <ScrollReveal delayMs={120}>
              <InsightCard
                icon="trending_down"
                title="Revenue declines silently"
                body="Revenue can fall below its usual level for hours before anyone notices something is wrong."
              />
            </ScrollReveal>
            <ScrollReveal delayMs={200}>
              <InsightCard
                icon="notifications"
                title="You find out too late"
                body="Teams often notice problems only after a client complains or the monthly numbers look wrong."
              />
            </ScrollReveal>
          </div>
        </div>
      </section>

      <section className={styles.valueSection}>
        <div className={styles.shell}>
          <ScrollReveal className={styles.centerHeading}>
            <h2>What RevenueWatch saves.</h2>
            <p>
              The payoff is simple: less manual checking, fewer missed issues,
              and fewer unpleasant surprises for clients.
            </p>
          </ScrollReveal>

          <div className={styles.valueGrid}>
            <ScrollReveal delayMs={40}>
              <ValueWidget
                icon="trending_down"
                label="Revenue visibility"
                metric=""
                title="Earlier issue visibility"
                body="Catch payment failures and revenue drops earlier, before they quietly affect connected Stripe accounts."
                variant="revenue"
              />
            </ScrollReveal>
            <ScrollReveal delayMs={120}>
              <ValueWidget
                icon="timer"
                label="Less manual checking"
                metric=""
                title="Manual checking time"
                body="Replace routine Stripe spot-checks with background monitoring, and review accounts only when an alert appears."
                variant="time"
              />
            </ScrollReveal>
            <ScrollReveal delayMs={200}>
              <ValueWidget
                icon="verified_user"
                label="Earlier awareness"
                metric=""
                title="Client trust"
                body="Spot issues earlier, respond sooner, and avoid the awkward “we just noticed” conversation."
                variant="trust"
              />
            </ScrollReveal>
          </div>
        </div>
      </section>

      <section className={styles.monitoringSection}>
        <div className={styles.shell}>
          <ScrollReveal className={styles.centerHeading}>
            <h2>See RevenueWatch in action.</h2>
            <p>
              See how RevenueWatch surfaces revenue drops and payment failure
              spikes in a calm, reviewable way, so you can step in before they
              turn into bigger problems.
            </p>
          </ScrollReveal>

          <div className={styles.monitoringRows}>
            <div className={styles.monitoringRow}>
              <ScrollReveal delayMs={140}>
                <RevenueMonitoringPreview />
              </ScrollReveal>

              <ScrollReveal delayMs={40}>
                <div className={styles.monitoringCopy}>
                  <h3>Catch unusual revenue drops</h3>
                  <p>
                    When RevenueWatch detects a revenue drop, it shows a clear
                    alert view with current revenue, usual revenue for this
                    period, and the threshold that triggered the alert.
                  </p>
                  <ul className={styles.monitoringList}>
                    <li>
                      <StitchIcon name="check_circle" className={styles.monitoringCheck} />
                      <span>Focused alert snapshot around the drop</span>
                    </li>
                    <li>
                      <StitchIcon name="check_circle" className={styles.monitoringCheck} />
                      <span>Current revenue, usual revenue, and threshold in the alert view</span>
                    </li>
                  </ul>
                </div>
              </ScrollReveal>
            </div>

            <div className={styles.monitoringRow}>
              <ScrollReveal delayMs={140}>
                <div className={styles.monitoringCopy}>
                  <h3>Spot payment failure spikes early</h3>
                  <p>
                    When failed payments spike within a short period,
                    RevenueWatch surfaces the issue in a simple alert view so
                    you can review the account before more customers are
                    affected.
                  </p>
                  <ul className={styles.monitoringList}>
                    <li>
                      <StitchIcon name="check_circle" className={styles.monitoringCheck} />
                      <span>Short recent window that makes the spike easy to review</span>
                    </li>
                    <li>
                      <StitchIcon name="check_circle" className={styles.monitoringCheck} />
                      <span>Current failures, usual level, and alert threshold in one view</span>
                    </li>
                  </ul>
                </div>
              </ScrollReveal>

              <ScrollReveal delayMs={40}>
                <FailureMonitoringPreview />
              </ScrollReveal>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className={styles.workflowSection}>
        <div className={styles.shell}>
          <ScrollReveal className={`${styles.centerHeading} ${styles.workflowHeading}`}>
            <h2>How RevenueWatch works.</h2>
            <p>
              Connect Stripe, let RevenueWatch monitor in the background, and
              step in only when attention is needed.
            </p>
          </ScrollReveal>

          <div className={styles.workflowGrid}>
            <ScrollReveal as="article" className={styles.stepOne} delayMs={40}>
              <div>
                <div className={styles.darkStep}>1</div>
                <h3>Connect with Stripe.</h3>
                <p>
                  Connect your Stripe account in about 30 seconds with secure,
                  read-only OAuth access. RevenueWatch never moves money or
                  changes settings in your Stripe account.
                </p>
              </div>

              <div className={styles.integrationCard}>
                <div className={styles.integrationAvatars} aria-hidden="true">
                  <span className={styles.avatarMuted} />
                  <span className={styles.avatarBlue}>
                    <StitchIcon name="sync" className={styles.syncIcon} />
                  </span>
                </div>

                <div>
                  <strong>Stripe connected</strong>
                  <p>Read-only monitoring active</p>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal as="article" className={styles.stepTwo} delayMs={120}>
              <div className={styles.lightStep}>2</div>

              <div>
                <h3>Monitoring in the background.</h3>
                <p>
                  RevenueWatch monitors for <span>payment failure spikes</span>{" "}
                  and unusual revenue drops in the background, so you do not
                  have to keep checking Stripe manually.
                </p>
              </div>

              <div className={styles.queryBubble}>
                <StitchIcon name="query_stats" className={styles.queryIcon} />
              </div>
            </ScrollReveal>

            <ScrollReveal as="article" className={styles.stepThree} delayMs={200}>
              <div className={styles.stepThreeCopy}>
                <div className={styles.darkStep}>3</div>
                <h3>Get alerted early.</h3>
                <p>
                  Receive a clear alert when RevenueWatch detects an unusual
                  change, so you can review it before it becomes a bigger
                  problem.
                </p>
              </div>

              <div className={styles.noticeCard}>
                <div className={styles.noticeBrandRow}>
                  <RevenueWatchLogo compact />
                </div>

                <div className={styles.noticeTop}>
                  <div className={styles.noticeTitle}>
                    <span>RevenueWatch alert</span>
                    <strong>Revenue drop detected</strong>
                  </div>

                  <span className={styles.noticePill}>High Severity</span>
                </div>

                <div className={styles.noticeDetails}>
                  <p>Connected account</p>
                  <h4>Northstar Commerce</h4>
                  <span className={styles.noticeDetected}>Detected: Today at 11:00 AM</span>
                </div>

                <div className={styles.noticeBody}>
                  <p className={styles.noticeIssueLabel}>Current issue</p>
                  <span>
                    Sales are 53% lower than usual for this period.
                  </span>
                </div>

                <div className={styles.noticeStatGrid}>
                  <div>
                    <p>Current revenue</p>
                    <strong className={styles.metaError}>€53,000</strong>
                  </div>
                  <div>
                    <p>Usual revenue</p>
                    <strong>€112,000</strong>
                  </div>

                  <div>
                    <p>Alert threshold</p>
                    <strong>€75,000</strong>
                  </div>
                </div>

                <div className={styles.noticeActionRow}>
                  <span className={styles.noticeAction}>Review this alert</span>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <section className={styles.trustSection}>
        <div className={styles.shell}>
          <ScrollReveal className={styles.centerHeading}>
            <h2>Secure, calm monitoring.</h2>
            <p>
              Connect with Stripe securely, keep access read-only, and receive
              clear alerts when something needs attention.
            </p>
          </ScrollReveal>

          <div className={styles.trustBento}>
            <ScrollReveal as="article" className={styles.trustBentoPrimary} delayMs={40}>
              <div className={styles.trustBentoContent}>
                <div className={styles.trustBentoIconWrap}>
                  <StitchIcon name="visibility" className={styles.trustIcon} />
                </div>
                <h3>Read-only access</h3>
                <p>
                  RevenueWatch connects through secure Stripe OAuth and never
                  changes billing, payouts, or account settings. It only reads
                  the data needed for monitoring.
                </p>
              </div>
              <div className={styles.trustShield} aria-hidden="true">
                <StitchIcon name="shield_lock" className={styles.trustShieldIcon} />
              </div>
            </ScrollReveal>

            <ScrollReveal as="article" className={styles.trustBentoDark} delayMs={120}>
              <div className={styles.trustBentoIconWrapDark}>
                <StitchIcon name="block" className={styles.trustDarkIcon} />
              </div>
              <div>
                <h3>No money movement</h3>
                <p>
                  RevenueWatch never moves funds, edits payouts, or performs
                  financial actions inside your account.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <section id="pricing" className={styles.pricingSection}>
        <div className={styles.shell}>
          <ScrollReveal className={styles.centerHeading}>
            <h2>Simple pricing for Stripe monitoring.</h2>
            <p>
              Choose the level of coverage you need, from one Stripe account to a
              larger portfolio of client accounts.
            </p>
          </ScrollReveal>

          <div className={styles.pricingGrid}>
            <ScrollReveal delayMs={40}>
              <PricingCard
                tier="Starter"
                description="For testing RevenueWatch on one Stripe account."
                price="Free"
                items={[
                  "1 Stripe account",
                  "Payment failure and revenue drop alerts",
                  "Email alerts",
                  "Read-only monitoring",
                ]}
                cta="Start free"
              />
            </ScrollReveal>

            <ScrollReveal delayMs={120}>
              <PricingCard
                tier="Growth"
                description="For small teams or agencies monitoring multiple Stripe accounts."
                price={"\u20AC39"}
                suffix="/mo"
                items={[
                  "Up to 10 Stripe accounts",
                  "Payment failure and revenue drop alerts",
                  "Multi-account monitoring",
                  "Email alerts",
                ]}
                cta="Start monitoring"
                featured
              />
            </ScrollReveal>

            <ScrollReveal delayMs={200}>
              <PricingCard
                tier="Pro"
                description="For larger teams or agencies managing more Stripe accounts."
                price={"\u20AC99"}
                suffix="/mo"
                items={[
                  "Up to 25 Stripe accounts",
                  "Payment failure and revenue drop alerts",
                  "Email alerts",
                  "Best for larger portfolios",
                ]}
                cta="Start monitoring"
              />
            </ScrollReveal>
          </div>

          <ScrollReveal as="p" className={styles.pricingFootnote} delayMs={120}>
            All plans use read-only Stripe access. RevenueWatch never moves money
            or changes Stripe account settings.
          </ScrollReveal>
        </div>
      </section>

      <section className={styles.faqSection}>
        <div className={styles.shell}>
          <ScrollReveal className={styles.centerHeading}>
            <h2>Frequently asked questions</h2>
            <p>A few clear answers before you connect Stripe.</p>
          </ScrollReveal>

          <div className={styles.faqGrid}>
            {FAQ_ITEMS.map((item, index) => (
              <ScrollReveal key={item.question} delayMs={40 + index * 30}>
                <FAQCard question={item.question} answer={item.answer} />
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal className={styles.faqCta} delayMs={120}>
            <p>Ready to monitor your Stripe account?</p>
            <Link href="/login" className={styles.primaryAction}>
              Get started
              <StitchIcon name="arrow_forward" className={styles.arrowIcon} />
            </Link>
          </ScrollReveal>
        </div>
      </section>

      <section className={styles.assuranceSection}>
        <div className={styles.shell}>
          <ScrollReveal className={styles.assuranceBar}>
            <div>
              <StitchIcon name="shield_lock" filled className={styles.assuranceIcon} />
              <span>Read-Only Stripe Access</span>
            </div>
            <div>
              <StitchIcon name="verified_user" filled className={styles.assuranceIcon} />
              <span>Built for Stripe</span>
            </div>
            <div>
              <StitchIcon name="lock" filled className={styles.assuranceIcon} />
              <span>No money movement</span>
            </div>
            <div>
              <StitchIcon name="shield_lock" filled className={styles.assuranceIcon} />
              <span>Secure Stripe OAuth</span>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <MarketingFooter />
    </main>
    </>
  );
}
