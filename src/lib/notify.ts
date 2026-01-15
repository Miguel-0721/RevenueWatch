import { Resend } from "resend";

console.log("🔥 notify.ts loaded");

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendAlertEmail({
  type,
  message,
}: {
  type: string;
  message: string;
}) {
  console.log("🚀 sendAlertEmail CALLED", { type, message });

  if (!process.env.RESEND_API_KEY) {
    console.error("❌ RESEND_API_KEY missing");
    return;
  }

  try {
    const result = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: ["miguelaamaya97@gmail.com"],
      subject: `🚨 RevenueWatch Alert: ${type}`,
      text: message,
    });

    console.log("📧 Email send result:", result);
  } catch (err) {
    console.error("❌ Resend error:", err);
  }
}
