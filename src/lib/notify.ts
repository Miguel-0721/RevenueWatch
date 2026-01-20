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
      subject: `RevenueWatch notification: ${type.replace("_", " ")}`,
      text: `This is an informational notification from RevenueWatch.

${message}

No action is required. This alert is provided for awareness only.`,
    });
  } catch (err) {
    console.error("Email send failed:", err);
  }
}
