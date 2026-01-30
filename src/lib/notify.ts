import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type SendAlertEmailArgs = {
  type: string;
  message: string;
};

export async function sendAlertEmail({
  type,
  message,
}: SendAlertEmailArgs) {
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY missing — email not sent");
    return;
  }

  if (!process.env.ALERT_EMAIL_TO) {
    console.error("ALERT_EMAIL_TO missing — email not sent");
    return;
  }

  try {
    await resend.emails.send({
      from: "RevenueWatch <alerts@revenuewatch.app>",
      to: [process.env.ALERT_EMAIL_TO],
    subject: `RevenueWatch alert: ${type.replace("_", " ")}`,
text: `RevenueWatch monitoring update

This is an automated, informational alert from RevenueWatch.

${message}

Why you are receiving this:
• RevenueWatch observed a sustained deviation from recent normal patterns.
• The detection is based on historical behavior, not a single event.

Important notes:
• This alert is informational only.
• It does not predict future performance.
• It does not recommend any action.
• Temporary fluctuations can be normal.

Monitoring remains active and will continue automatically.`,


    });
  } catch (err) {
    console.error("Email send failed:", err);
  }
}
