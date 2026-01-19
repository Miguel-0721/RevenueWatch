"use client";

import { useState } from "react";

export function DisconnectButton({
  stripeAccountId,
}: {
  stripeAccountId: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleDisconnect() {
    if (loading) return;

    const confirmed = window.confirm(
      "Disconnect this Stripe account?\n\nMonitoring will stop and alerts will no longer be generated."
    );

    if (!confirmed) return;

    setLoading(true);

    try {
      await fetch("/api/stripe/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stripeAccountId }),
      });

      window.location.reload();
    } catch (err) {
      console.error("Disconnect failed", err);
      alert("Failed to disconnect account.");
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDisconnect}
      disabled={loading}
      style={{
        background: "#fee2e2",
        color: "#991b1b",
        border: "1px solid #fecaca",
        borderRadius: 6,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 600,
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? "Disconnecting…" : "Disconnect"}
    </button>
  );
}
