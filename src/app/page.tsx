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
        <div className={styles.shell}>
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
                Get notified when payments fail or revenue drops across your Stripe
                accounts. Read-only monitoring, clear alerts, and no money movement.
              </p>

              <div className={styles.heroActions}>
                <Link href="/login" className={styles.primaryAction}>
                  Connect Stripe &amp; start monitoring
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

      <section className={styles.trustSection}>
        <div className={styles.shell}>
          <div className={styles.centerHeading}>
            <h2>Secure, calm monitoring.</h2>
            <p>We focus on your revenue health without ever touching your money.</p>
          </div>

          <div className={styles.trustGrid}>
            <TrustCard
              icon="visibility"
              title="Read-only access"
              body="We monitor Stripe data without changing billing, payouts, or account settings."
            />
            <TrustCard
              icon="block"
              title="No money movement"
              body="RevenueWatch does not move funds, edit payouts, or perform financial actions."
            />
            <TrustCard
              icon="notifications"
              title="Monitoring and alerts only"
              body="Get clear alerts when payment failures spike or revenue drops unexpectedly."
            />
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
                  Securely connect your Stripe accounts using read-only access.
                  One-click OAuth integration for monitoring only.
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
                  RevenueWatch tracks <span>payment failures</span> and revenue
                  changes in real time, looking for anything unusual.
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
                  Receive a clear email when something needs your attention. Fixed
                  before the client even notices a drop. No complex dashboards, just
                  the info you need.
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

      <section id="pricing" className={styles.pricingSection}>
        <div className={styles.shell}>
          <div className={styles.centerHeading}>
            <h2>Simple pricing based on how many Stripe accounts you monitor</h2>
            <p>Paid plans are built for teams managing multiple Stripe accounts.</p>
          </div>

          <div className={styles.pricingGrid}>
            <PricingCard
              tier="Starter"
              description="For individuals monitoring a single Stripe account"
              price="Free"
              items={[
                "1 Stripe account",
                "Payment failure alerts",
                "Revenue drop alerts",
                "Read-only monitoring",
              ]}
              cta="Start free"
            />

            <PricingCard
              tier="Growth"
              description="Monitor multiple Stripe accounts across clients in one place."
              price={"\u20AC79"}
              suffix="/mo"
              items={[
                "Up to 10 Stripe accounts",
                "Payment failure + revenue alerts",
                "Multi-account monitoring",
                "Instant email alerts",
              ]}
              cta="Start monitoring"
              featured
            />

            <PricingCard
              tier="Pro"
              description="For teams managing a larger number of Stripe accounts"
              price={"\u20AC149"}
              suffix="/mo"
              items={[
                "Up to 25 Stripe accounts",
                "All alerts across connected",
                "Higher account capacity",
                "Designed for larger teams",
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
