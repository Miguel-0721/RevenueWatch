import { redirect } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import MarketingFooter from "@/components/MarketingFooter";
import StitchIcon from "@/components/StitchIcon";
import { signIn, auth } from "../../auth";
import styles from "./login.module.css";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className={styles.providerIcon} aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.24 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.851 1.154 7.966 3.034l5.657-5.657C34.053 6.053 29.277 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c3.059 0 5.851 1.154 7.966 3.034l5.657-5.657C34.053 6.053 29.277 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.176 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.149 35.091 26.715 36 24 36c-5.219 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.085 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.providerIcon} aria-hidden="true">
      <rect x="2" y="2" width="9" height="9" fill="#F25022" />
      <rect x="13" y="2" width="9" height="9" fill="#7FBA00" />
      <rect x="2" y="13" width="9" height="9" fill="#00A4EF" />
      <rect x="13" y="13" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className={styles.page}>
      <Navbar mode="marketing" ctaLabel="Sign in" ctaHref="/login" />
      <main className={styles.main}>
        <section className={styles.heroShell}>
          <div className={styles.copy}>
            <div className={styles.eyebrow}>
              <StitchIcon name="monitoring" className={styles.eyebrowIcon} />
              Dashboard access
            </div>
            <h1>
              Access <span>RevenueWatch</span>.
            </h1>
            <p>Sign in with your work account to open the dashboard and review alerts.</p>
            <div className={styles.trustLine}>
              <span>Read-only access.</span>
              <span>No money movement.</span>
              <span>Secure OAuth.</span>
            </div>
          </div>

          <div className={styles.side}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2>Sign in</h2>
                <p>Use Google or Microsoft to continue.</p>
              </div>

              <div className={styles.actions}>
                <form
                  className={styles.providerForm}
                  action={async () => {
                    "use server";
                    await signIn("google", { redirectTo: "/dashboard" });
                  }}
                >
                  <button
                    type="submit"
                    className={`${styles.providerButton} ${styles.providerButtonPrimary}`}
                  >
                    <div className={styles.providerMeta}>
                      <GoogleIcon />
                      <div className={styles.providerCopy}>
                        <span className={styles.providerLabel}>Continue with Google</span>
                        <span className={styles.providerHint}>Use your existing work account</span>
                      </div>
                    </div>
                    <StitchIcon name="arrow_forward" className={styles.providerArrow} />
                  </button>
                </form>

                <div className={styles.providerForm}>
                  <button
                    type="button"
                    className={`${styles.providerButton} ${styles.providerButtonMuted}`}
                    aria-disabled="true"
                  >
                    <div className={styles.providerMeta}>
                      <MicrosoftIcon />
                      <div className={styles.providerCopy}>
                        <span className={styles.providerLabel}>Continue with Microsoft</span>
                        <span className={styles.providerHint}>Coming soon</span>
                      </div>
                    </div>
                    <span className={styles.soonBadge}>Soon</span>
                  </button>
                </div>
              </div>

              <div className={styles.supportStrip}>
                <div className={styles.supportItem}>
                  <StitchIcon name="lock" className={styles.supportIcon} />
                  Secure OAuth
                </div>
                <div className={styles.supportItem}>
                  <StitchIcon name="notifications" className={styles.supportIcon} />
                  Alert-ready access
                </div>
              </div>

              <p className={styles.helpText}>
                Need help with access? <Link href="/contact">Contact support</Link>
              </p>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
