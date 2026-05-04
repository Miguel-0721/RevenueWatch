import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

const resend = new Resend(process.env.RESEND_API_KEY);
const ALERT_SENDER = "RevenueWatch <alerts@revenuewatch.app>";
const ALERT_REPLY_TO = "contact@revenuewatch.app";

type SendAlertEmailArgs = {
  type: string;
  severity: string;
  message: string;
  stripeAccountId: string | null;
  detectedAt?: Date | null;
  context?: string | null;
};

function safeParseContext(input?: string | null) {
  if (!input) return null;

  try {
    return JSON.parse(input) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMoneyAmount(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatAlertType(type: string) {
  if (type === "revenue_drop") return "Revenue drop detected";
  if (type === "payment_failed") return "Payment failure spike";
  return type.replace(/_/g, " ");
}

function formatAlertSubject(type: string) {
  if (type === "revenue_drop") {
    return "RevenueWatch alert: Revenue drop detected";
  }

  if (type === "payment_failed") {
    return "RevenueWatch alert: Payment failure spike detected";
  }

  return `RevenueWatch alert: ${formatAlertType(type)}`;
}

function formatSeverity(severity: string) {
  return severity === "critical" ? "High Severity" : "Review Needed";
}

function formatDetectedAt(date?: Date | null) {
  if (!date) return "Unknown";

  const target = new Date(date);
  const monthDay = target.toLocaleDateString([], {
    month: "long",
    day: "numeric",
  });
  const time = target.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${monthDay} at ${time}`;
}

function getDetectedDate(context?: string | null, detectedAt?: Date | null) {
  if (detectedAt) return detectedAt;

  const parsed = safeParseContext(context);
  if (!parsed) return null;

  if (typeof parsed.currentWindowStart === "string") {
    const parsedDate = new Date(parsed.currentWindowStart);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }

  return null;
}

function buildMainMessage(type: string, message: string, context?: string | null) {
  const parsed = safeParseContext(context);

  if (type === "revenue_drop" && parsed) {
    const currentRevenue =
      typeof parsed.currentAmount === "number"
        ? parsed.currentAmount
        : typeof parsed.currentRevenue === "number"
          ? parsed.currentRevenue
          : null;
    const usualRevenue =
      typeof parsed.baselineAmount === "number"
        ? parsed.baselineAmount
        : typeof parsed.expectedRevenue === "number"
          ? parsed.expectedRevenue
          : null;
    const dropPercent =
      typeof parsed.dropRatio === "number"
        ? Math.round(parsed.dropRatio * 100)
        : currentRevenue !== null &&
            usualRevenue !== null &&
            usualRevenue > 0
          ? Math.round(((usualRevenue - currentRevenue) / usualRevenue) * 100)
          : null;

    if (dropPercent !== null) {
      return `Sales are ${dropPercent}% lower than usual for this window.`;
    }
  }

  if (type === "payment_failed") {
    return "Payment failures are significantly higher than usual compared to recent activity.";
  }

  return message;
}

function buildKeyAlertValues(type: string, context?: string | null) {
  const parsed = safeParseContext(context);
  if (!parsed) return [];

  if (type === "payment_failed") {
    const currentFailures =
      typeof parsed.currentFailures === "number"
        ? parsed.currentFailures
        : typeof parsed.failuresCounted === "number"
          ? parsed.failuresCounted
          : null;
    const usualFailures =
      typeof parsed.usualFailures === "number"
        ? parsed.usualFailures
        : typeof parsed.normalFailures === "number"
          ? parsed.normalFailures
          : typeof parsed.baseline === "number"
            ? parsed.baseline
            : null;
    const threshold =
      typeof parsed.failureThreshold === "number" ? parsed.failureThreshold : null;

    return [
      currentFailures !== null
        ? `Current failed payments: ${formatCount(currentFailures)}`
        : null,
      usualFailures !== null
        ? `Usual failed payments: ${formatCount(usualFailures)}`
        : null,
      threshold !== null ? `Alert threshold: ${formatCount(threshold)}` : null,
    ].filter((line): line is string => Boolean(line));
  }

  if (type === "revenue_drop") {
    const currentRevenue =
      typeof parsed.currentAmount === "number"
        ? parsed.currentAmount
        : typeof parsed.currentRevenue === "number"
          ? parsed.currentRevenue
          : null;
    const usualRevenue =
      typeof parsed.baselineAmount === "number"
        ? parsed.baselineAmount
        : typeof parsed.expectedRevenue === "number"
          ? parsed.expectedRevenue
          : null;
    const threshold =
      typeof parsed.alertThresholdAmount === "number"
        ? parsed.alertThresholdAmount
        : null;
    const dropPercent =
      typeof parsed.dropRatio === "number"
        ? Math.round(parsed.dropRatio * 100)
        : currentRevenue !== null &&
            usualRevenue !== null &&
            usualRevenue > 0
          ? Math.round(((usualRevenue - currentRevenue) / usualRevenue) * 100)
          : null;

    return [
      currentRevenue !== null ? `Current revenue: ${formatMoneyAmount(currentRevenue)}` : null,
      usualRevenue !== null ? `Usual revenue: ${formatMoneyAmount(usualRevenue)}` : null,
      threshold !== null ? `Alert threshold: ${formatMoneyAmount(threshold)}` : null,
    ].filter((line): line is string => Boolean(line));
  }

  return [];
}

function buildContextSection(type: string, context?: string | null) {
  const values = buildKeyAlertValues(type, context);
  return values.length > 0 ? `\nKey alert values:\n${values.join("\n")}` : "";
}

function buildEmailBrandHeader(wordmarkSrc: string) {
  return `<img src="${escapeHtml(wordmarkSrc)}" alt="RevenueWatch" width="292" style="display:block;width:auto;max-width:292px;height:32px;object-fit:contain;" />`;
}

function buildHtmlEmail({
  accountLabel,
  alertType,
  severityLabel,
  detectedLabel,
  mainMessage,
  keyValues,
  detailsUrl,
  wordmarkSrc,
}: {
  accountLabel: string;
  alertType: string;
  severityLabel: string;
  detectedLabel: string;
  mainMessage: string;
  keyValues: string[];
  detailsUrl: string | null;
  wordmarkSrc: string;
}) {
  const isCritical = severityLabel === "High Severity";
  const badgeBg = isCritical ? "#ffdad6" : "#fff1c2";
  const badgeText = isCritical ? "#ba1a1a" : "#8a5a00";
  const accentBg = isCritical ? "#fff6f5" : "#f7f9fc";
  const buttonHtml = detailsUrl
    ? `<div style="margin-top:24px;"><a href="${escapeHtml(detailsUrl)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#0058bc;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">Review this alert</a></div>`
    : "";
  const keyValuesHtml =
    keyValues.length > 0
      ? `<div style="margin-top:22px;">
          ${keyValues
            .map((line) => {
              const [label, ...rest] = line.split(": ");
              return `<div style="padding:10px 12px;border:1px solid rgba(193,198,215,0.3);border-radius:10px;background:#ffffff;margin-top:8px;">
                <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#717786;">${escapeHtml(label)}</div>
                <div style="margin-top:4px;font-size:15px;line-height:1.4;color:#191c1d;font-weight:700;">${escapeHtml(rest.join(": "))}</div>
              </div>`;
            })
            .join("")}
        </div>`
      : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f5f7fa;font-family:Inter,Arial,Helvetica,sans-serif;color:#191c1d;">
    <div style="max-width:640px;margin:0 auto;">
      <div style="background:#ffffff;border:1px solid rgba(193,198,215,0.28);border-radius:18px;box-shadow:0 8px 24px rgba(25,28,29,0.06);overflow:hidden;">
        <div style="padding:18px 28px;border-bottom:1px solid rgba(193,198,215,0.18);background:linear-gradient(180deg,#f8fbff 0%,#ffffff 100%);">
          ${buildEmailBrandHeader(wordmarkSrc)}
        </div>
        <div style="padding:28px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:18px;flex-wrap:wrap;">
            <div style="font-size:28px;line-height:1.08;font-weight:800;letter-spacing:-0.04em;color:#191c1d;">${escapeHtml(alertType)}</div>
            <span style="display:inline-flex;align-items:center;padding:6px 12px;border-radius:999px;background:${badgeBg};color:${badgeText};font-size:12px;font-weight:800;white-space:nowrap;">${escapeHtml(severityLabel)}</span>
          </div>
          <div style="margin-top:20px;padding:16px 18px;border-radius:14px;background:${accentBg};border:1px solid rgba(193,198,215,0.2);">
            <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#717786;">Connected account</div>
            <div style="margin-top:4px;font-size:19px;line-height:1.3;font-weight:800;color:#191c1d;">${escapeHtml(accountLabel)}</div>
            <div style="margin-top:10px;font-size:13px;line-height:1.5;color:#5a6170;"><strong style="color:#414755;">Detected:</strong> ${escapeHtml(detectedLabel)}</div>
          </div>
          <div style="margin-top:22px;">
            <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#717786;">Current issue</div>
            <div style="margin-top:8px;font-size:16px;line-height:1.65;color:#414755;">${escapeHtml(mainMessage)}</div>
          </div>
          ${keyValuesHtml}
          ${buttonHtml}
          <div style="margin-top:26px;padding-top:18px;border-top:1px solid rgba(193,198,215,0.22);font-size:12px;line-height:1.6;color:#717786;">
            This alert is informational only. RevenueWatch does not predict future performance or recommend any action.
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

export async function sendAlertEmail({
  type,
  severity,
  message,
  stripeAccountId,
  detectedAt,
  context,
}: SendAlertEmailArgs) {
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY missing - email not sent");
    return;
  }

  const account = stripeAccountId
    ? await prisma.stripeAccount.findUnique({
        where: { stripeAccountId },
        select: {
          name: true,
          stripeAccountId: true,
          user: {
            select: {
              email: true,
            },
          },
        },
      })
    : null;
  const isProduction = process.env.NODE_ENV === "production";
  const recipient = account?.user?.email || (!isProduction ? process.env.ALERT_EMAIL_TO ?? null : null);

  if (!recipient) {
    console.error("Alert email recipient missing - email not sent", {
      stripeAccountId,
      environment: process.env.NODE_ENV ?? "unknown",
      hasOwnerEmail: Boolean(account?.user?.email),
      hasAlertEmailFallback: Boolean(process.env.ALERT_EMAIL_TO),
    });
    return;
  }

  const accountLabel = account?.name?.trim() || account?.stripeAccountId || stripeAccountId || "Stripe account";
  const keyValues = buildKeyAlertValues(type, context);
  const contextSection = buildContextSection(type, context);
  const resolvedDetectedAt = getDetectedDate(context, detectedAt);
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "");
  const detailsUrl =
    appUrl && stripeAccountId
      ? `${appUrl}/dashboard/accounts/${encodeURIComponent(stripeAccountId)}`
      : null;
  const wordmarkSrc = `${appUrl}/brand/revenuewatch-wordmark.png`;
  const mainMessage = buildMainMessage(type, message, context);
  const alertTypeLabel = formatAlertType(type);
  const severityLabel = formatSeverity(severity);
  const detectedLabel = formatDetectedAt(resolvedDetectedAt);
  const html = buildHtmlEmail({
    accountLabel,
    alertType: alertTypeLabel,
    severityLabel,
    detectedLabel,
    mainMessage,
    keyValues,
    detailsUrl,
    wordmarkSrc,
  });

  console.log("ALERT EMAIL START", {
    alertType: type,
    recipient,
    sender: ALERT_SENDER,
    replyTo: ALERT_REPLY_TO,
  });

  try {
    const result = await resend.emails.send({
      from: ALERT_SENDER,
      replyTo: ALERT_REPLY_TO,
      to: [recipient],
      subject: formatAlertSubject(type),
      html,
      text: `RevenueWatch monitoring update

This is an automated, informational alert from RevenueWatch.

Account: ${accountLabel}
Alert type: ${alertTypeLabel}
Severity: ${severityLabel}
Detected: ${detectedLabel}

${mainMessage}${contextSection}${detailsUrl ? `\n\nReview this alert:\n${detailsUrl}` : ""}

Why you are receiving this:
- RevenueWatch observed a sustained deviation from recent normal patterns.
- The detection is based on historical behavior, not a single event.

Important notes:
- This alert is informational only.
- It does not predict future performance.
- It does not recommend any action.
- Temporary fluctuations can be normal.

Monitoring remains active and will continue automatically.`,
    });

    console.log("ALERT EMAIL SUCCESS", {
      alertType: type,
      recipient,
      sender: ALERT_SENDER,
      replyTo: ALERT_REPLY_TO,
      resendId: result.data?.id ?? null,
      resendError: result.error ?? null,
    });
  } catch (error) {
    console.error("ALERT EMAIL FAILED", {
      alertType: type,
      recipient,
      sender: ALERT_SENDER,
      replyTo: ALERT_REPLY_TO,
      error,
    });
  }
}
