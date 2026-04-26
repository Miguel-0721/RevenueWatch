import { auth } from "@/auth";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <>
      <Navbar mode="app" />
      <main
        style={{
          minHeight: "calc(100vh - 180px)",
          padding: "48px 24px 72px",
          background: "#f8f9fa",
        }}
      >
        <div
          style={{
            maxWidth: 760,
            margin: "0 auto",
            display: "grid",
            gap: 18,
          }}
        >
          <Link
            href="/dashboard"
            style={{
              color: "#64748b",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Back to dashboard
          </Link>

          <section
            style={{
              padding: 32,
              borderRadius: 18,
              background: "#ffffff",
              border: "1px solid rgba(193, 198, 215, 0.22)",
              boxShadow: "0 2px 8px rgba(25, 28, 29, 0.035)",
            }}
          >
            <h1
              style={{
                marginBottom: 12,
                fontSize: 40,
                lineHeight: 1,
                fontWeight: 900,
                letterSpacing: "-0.05em",
              }}
            >
              Settings
            </h1>
            <p
              style={{
                color: "#414755",
                fontSize: 17,
                lineHeight: 1.7,
              }}
            >
              Account settings will live here. RevenueWatch will keep this surface
              focused on access, notifications, and monitoring configuration.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
