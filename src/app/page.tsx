import Link from "next/link";
import MarketingFooter from "@/components/MarketingFooter";
import StitchIcon from "@/components/StitchIcon";
import type { IconName } from "@/components/StitchIcon";
import styles from "./page.module.css";

function HeroWidget() {
  return (
    <div className={styles.heroWidgetWrap}>
      <div className={styles.heroWidget}>
        <div className={styles.heroWidgetTop}>
          <div>
            <p className={styles.overline}>Live Revenue Monitor</p>
            <div className={styles.heroKpiRow}>
              <h3>$12,482.00</h3>
              <StitchIcon name="error" className={styles.errorIcon} />
            </div>
          </div>

          <div className={styles.anomalyCard}>
            <span>Anomaly Detected</span>
            <p>-42.4% vs Projected</p>
          </div>
        </div>

        <div className={styles.graphCard}>
          <svg viewBox="0 0 400 160" className={styles.graphSvg} aria-hidden="true">
            <defs>
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#0070eb" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#0070eb" stopOpacity="0" />
              </linearGradient>
            </defs>

            <g stroke="#e2e8f0" strokeWidth="0.5">
              <line x1="0" y1="20" x2="400" y2="20" />
              <line x1="0" y1="40" x2="400" y2="40" />
              <line x1="0" y1="60" x2="400" y2="60" />
              <line x1="0" y1="80" x2="400" y2="80" />
              <line x1="0" y1="100" x2="400" y2="100" />
              <line x1="0" y1="120" x2="400" y2="120" />
              <line x1="0" y1="140" x2="400" y2="140" />
            </g>

            <g stroke="#e2e8f0" strokeDasharray="2,2" strokeWidth="0.5">
              <line x1="100" y1="0" x2="100" y2="160" />
              <line x1="200" y1="0" x2="200" y2="160" />
              <line x1="300" y1="0" x2="300" y2="160" />
            </g>

            <path
              d="M 0 50 L 50 48 L 100 52 L 150 49 L 200 51 L 250 48 L 300 50 L 350 49 L 400 50"
              fill="none"
              stroke="#cbd5e1"
              strokeDasharray="3,3"
              strokeWidth="0.75"
            />

            <path
              d="M 0 52 L 40 48 L 80 50 L 120 46 L 160 54 L 200 48 L 240 52 L 270 55 L 290 130 L 320 135 L 350 120 L 400 115 L 400 160 L 0 160 Z"
              fill="url(#lineGradient)"
            />

            <path
              d="M 0 52 L 40 48 L 80 50 L 120 46 L 160 54 L 200 48 L 240 52 L 270 55 L 290 130 L 320 135 L 350 120 L 400 115"
              fill="none"
              stroke="#0070eb"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
            />

            <path
              d="M 270 55 L 290 130 L 320 135"
              fill="none"
              stroke="#ba1a1a"
              strokeLinecap="round"
              strokeWidth="2"
            />

            <circle cx="0" cy="52" r="1.5" fill="#0070eb" />
            <circle cx="200" cy="48" r="1.5" fill="#0070eb" />
            <circle cx="270" cy="55" r="1.5" fill="#0070eb" />
            <circle cx="290" cy="130" r="5" fill="#ba1a1a" opacity="0.4" />
            <circle cx="290" cy="130" r="2.5" fill="#ba1a1a" />
          </svg>

          <div className={styles.overlayTag}>Anomaly Detected</div>
        </div>

        <div className={styles.graphMeta}>
          <div className={styles.graphMetaCard}>
            <p className={styles.overline}>Stripe Account</p>
            <div className={styles.accountRow}>
              <span className={styles.accountDot} />
              <span>Alpha Tech Global</span>
            </div>
          </div>

          <div className={styles.graphMetaCard}>
            <p className={styles.overline}>Alert Priority</p>
            <span className={styles.criticalText}>Critical Action Required</span>
          </div>
        </div>
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
        href={tier === "Pro" ? "/contact" : "/login"}
        className={featured ? styles.primaryAction : styles.secondaryAction}
      >
        {cta}
      </Link>
    </article>
  );
}

export default function HomePage() {
  return (
    <main className={styles.page}>
      <section className={styles.heroSection}>
        <div className={styles.heroShell}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <span className={styles.partnerBadge}>
                <StitchIcon name="verified" filled className={styles.partnerIcon} />
                Stripe Verified Partner
              </span>

              <h1>
                Catch <span>payment failures</span> and <span>revenue drops</span>{" "}
                before your clients do.
              </h1>

              <p>
                RevenueWatch watches your Stripe accounts in the background and
                alerts you when something goes wrong, before missed payments or
                silent revenue drops turn into client-facing problems.
              </p>

              <div className={styles.heroTrustLine}>
                <span>Read-only access.</span>
                <span>No money movement.</span>
                <span>No risk.</span>
              </div>

              <div className={styles.heroActions}>
                <Link href="/login" className={styles.primaryAction}>
                  Protect your revenue
                  <StitchIcon name="arrow_forward" className={styles.arrowIcon} />
                </Link>

                <a href="#how-it-works" className={styles.secondaryAction}>
                  How it works
                </a>
              </div>
            </div>

            <HeroWidget />
          </div>
        </div>
      </section>

      <section className={styles.insightSection}>
        <div className={styles.shell}>
          <div className={styles.centerHeading}>
            <h2>What happens without RevenueWatch?</h2>
            <p>
              Stripe issues often stay invisible until they have already cost you
              revenue, time, or trust.
            </p>
          </div>

          <div className={styles.insightGrid}>
            <InsightCard
              icon="warning"
              title="Payment failures go unnoticed"
              body="A failing payment flow can sit quietly in Stripe while revenue drops in the background."
            />
            <InsightCard
              icon="trending_down"
              title="Revenue declines silently"
              body="Small drops compound fast when nobody is watching the account day to day."
            />
            <InsightCard
              icon="notifications"
              title="You find out too late"
              body="Many teams only notice a problem after a client complains or monthly numbers look wrong."
            />
          </div>
        </div>
      </section>

      <section className={styles.trustSection}>
        <div className={styles.shell}>
          <div className={styles.centerHeading}>
            <h2>Secure, calm monitoring.</h2>
            <p>
              Built for Stripe OAuth, read-only monitoring, and clear alerting
              when your revenue needs attention.
            </p>
          </div>

          <div className={styles.trustBento}>
            <article className={styles.trustBentoPrimary}>
              <div className={styles.trustBentoContent}>
                <div className={styles.trustBentoIconWrap}>
                  <StitchIcon name="visibility" className={styles.trustIcon} />
                </div>
                <h3>Read-only access</h3>
                <p>
                  We connect through secure Stripe OAuth and never change billing,
                  payouts, or account settings. Your data is for eyes only.
                </p>
              </div>
              <div className={styles.trustShield} aria-hidden="true">
                <StitchIcon name="shield_lock" className={styles.trustShieldIcon} />
              </div>
            </article>

            <article className={styles.trustBentoDark}>
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
            </article>

            <article className={styles.trustBentoWide}>
              <div className={styles.trustBentoWideCopy}>
                <div className={styles.trustBentoIconWrap}>
                  <StitchIcon name="notifications" className={styles.trustIcon} />
                </div>
                <h3>Early-warning alerts only</h3>
                <p>
                  You get notified when payment failures spike or revenue drops
                  unexpectedly, before the damage spreads. No complex dashboards,
                  just the news that matters.
                </p>
              </div>
              <div className={styles.trustNotification} aria-hidden="true">
                <div className={styles.trustNotificationTop}>
                  <span className={styles.trustPing} />
                  <strong>Critical Notification</strong>
                </div>
                <div className={styles.trustNotificationLineLong} />
                <div className={styles.trustNotificationLineShort} />
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="how-it-works" className={styles.workflowSection}>
        <div className={styles.shell}>
          <div className={styles.sectionHeading}>
            <h2>How it works.</h2>
            <div className={styles.headingBar} />
          </div>

          <div className={styles.workflowGrid}>
            <article className={styles.stepOne}>
              <div>
                <div className={styles.darkStep}>1</div>
                <h3>Connect with Stripe.</h3>
                <p>
                  Connect your Stripe account in about 30 seconds with secure,
                  read-only OAuth access. We never touch your money.
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
                  <strong>Stripe Integrated</strong>
                  <p>Read-only permissions active</p>
                </div>
              </div>
            </article>

            <article className={styles.stepTwo}>
              <div className={styles.lightStep}>2</div>

              <div>
                <h3>Monitoring in the background.</h3>
                <p>
                  RevenueWatch watches for <span>payment failures</span>, revenue
                  drops, and quiet issues that can sit in Stripe unnoticed.
                </p>
              </div>

              <div className={styles.queryBubble}>
                <StitchIcon name="query_stats" className={styles.queryIcon} />
              </div>
            </article>

            <article className={styles.stepThree}>
              <div className={styles.stepThreeCopy}>
                <div className={styles.darkStep}>3</div>
                <h3>Get notified instantly.</h3>
                <p>
                  Get a clear alert as soon as something breaks so you can fix it
                  before it becomes expensive or client-facing.
                </p>
              </div>

              <div className={styles.noticeCard}>
                <div className={styles.noticeTop}>
                  <div className={styles.noticeTitle}>
                    <div className={styles.noticeIconWrap}>
                      <StitchIcon name="warning" className={styles.noticeIcon} />
                    </div>
                    <span>Significant Revenue Drop Detected</span>
                  </div>

                  <span className={styles.noticePill}>Critical Alert</span>
                </div>

                <div className={styles.noticeDetails}>
                  <p>Alert Details</p>
                  <h4>
                    Account <span>Client Alpha</span> revenue dropped <em>45%</em>{" "}
                    compared to the usual trend in the last 2 hours.
                  </h4>
                </div>

                <div className={styles.noticeMeta}>
                  <div>
                    <p>Time Window</p>
                    <div className={styles.noticeMetaRow}>
                      <StitchIcon name="schedule" className={styles.metaIcon} />
                      <strong>Last 2 Hours</strong>
                    </div>
                  </div>

                  <div>
                    <p>Impact</p>
                    <div className={styles.noticeMetaRow}>
                      <StitchIcon name="trending_down" className={styles.metaIconError} />
                      <strong className={styles.metaError}>High (-$4,200)</strong>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.valueSection}>
        <div className={styles.shell}>
          <div className={styles.centerHeading}>
            <span className={styles.valueEyebrow}>Value Proposition</span>
            <h2>What RevenueWatch saves.</h2>
            <p>
              Quantifiable operational benefits that go beyond simple monitoring.
            </p>
          </div>

          <div className={styles.valueGrid}>
            <ValueWidget
              icon="trending_down"
              label="Revenue Recovery"
              metric="+$12,400"
              title="Missed revenue"
              body="Our anomaly detection identifies technical payment blocks that would otherwise drain your MRR without ever hitting an error log."
              variant="revenue"
            />
            <ValueWidget
              icon="timer"
              label="Operational Efficiency"
              metric="10h Saved/mo"
              title="Manual checking time"
              body="Stop the daily Stripe scroll. Replace manual dashboard checks with passive confidence and only step in when action is required."
              variant="time"
            />
            <ValueWidget
              icon="verified_user"
              label="Retention Index"
              metric="100% Reliability"
              title="Client trust"
              body="Be the team that spots issues first. Early response protects confidence before customers or clients ever feel the problem."
              variant="trust"
            />
          </div>
        </div>
      </section>

      <section id="pricing" className={styles.pricingSection}>
        <div className={styles.shell}>
          <div className={styles.centerHeading}>
            <h2>Simple pricing for the number of Stripe accounts you monitor</h2>
            <p>
              Choose the level of coverage you need, from one Stripe account to a
              larger portfolio of client accounts.
            </p>
          </div>

          <div className={styles.pricingGrid}>
            <PricingCard
              tier="Starter"
              description="For one Stripe account that needs simple early-warning coverage."
              price="Free"
              items={[
                "1 Stripe account",
                "Payment failure detection",
                "Revenue drop detection",
                "Read-only monitoring",
              ]}
              cta="Start free"
            />

            <PricingCard
              tier="Growth"
              description="For teams or agencies watching multiple Stripe accounts in one place."
              price={"\u20AC79"}
              suffix="/mo"
              items={[
                "Up to 10 Stripe accounts",
                "Revenue and failure alerts",
                "Multi-account coverage",
                "Instant email alerts",
              ]}
              cta="Protect your accounts"
              featured
            />

            <PricingCard
              tier="Pro"
              description="For larger teams that need broader account coverage and more alert capacity."
              price={"\u20AC149"}
              suffix="/mo"
              items={[
                "Up to 25 Stripe accounts",
                "Alerts across connected accounts",
                "Higher account capacity",
                "Best for larger teams",
              ]}
              cta="Contact us"
            />
          </div>

          <p className={styles.pricingFootnote}>
            All plans use read-only Stripe access. RevenueWatch never moves money
            or modifies your account.
          </p>
        </div>
      </section>

      <section className={styles.assuranceSection}>
        <div className={styles.shell}>
          <div className={styles.assuranceBar}>
            <div>
              <StitchIcon name="shield_lock" filled className={styles.assuranceIcon} />
              <span>Read-Only Infrastructure</span>
            </div>
            <div>
              <StitchIcon name="verified_user" filled className={styles.assuranceIcon} />
              <span>Stripe Verified Partner</span>
            </div>
            <div>
              <StitchIcon name="lock" filled className={styles.assuranceIcon} />
              <span>No money movement</span>
            </div>
            <div>
              <StitchIcon name="encrypted" filled className={styles.assuranceIcon} />
              <span>256-bit AES Encryption</span>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
