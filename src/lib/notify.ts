import { Resend } from "resend";
import { formatMoneyAmount, normalizeCurrencyCode } from "@/lib/currency";
import { prisma } from "@/lib/prisma";

const resend = new Resend(process.env.RESEND_API_KEY);
const ALERT_SENDER = "Parveil <alerts@parveil.com>";
const ALERT_REPLY_TO = "contact@parveil.com";
const EMAIL_BRAND_ICON_URL = "https://parveil.com/parveil-icon.png?v=3";

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
    return "Parveil alert: Revenue drop detected";
  }

  if (type === "payment_failed") {
    return "Parveil alert: Payment failure spike detected";
  }

  return `Parveil alert: ${formatAlertType(type)}`;
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
    if (parsed && typeof parsed.displayMessage === "string") {
      return parsed.displayMessage;
    }

    return message;
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
    const currency =
      typeof parsed.currency === "string" ? normalizeCurrencyCode(parsed.currency) : undefined;
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
      currentRevenue !== null ? `Current revenue: ${formatMoneyAmount(currentRevenue, currency)}` : null,
      usualRevenue !== null ? `Usual revenue: ${formatMoneyAmount(usualRevenue, currency)}` : null,
      threshold !== null ? `Review threshold: ${formatMoneyAmount(threshold, currency)}` : null,
    ].filter((line): line is string => Boolean(line));
  }

  return [];
}

function buildContextSection(type: string, context?: string | null) {
  const values = buildKeyAlertValues(type, context);
  return values.length > 0 ? `\nKey alert values:\n${values.join("\n")}` : "";
}

function buildMetricCards(type: string, severityLabel: string, context?: string | null) {
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
        ? { label: "Current failed payments", value: formatCount(currentFailures), accent: false }
        : null,
      usualFailures !== null
        ? { label: "Usual failed payments", value: formatCount(usualFailures), accent: false }
        : null,
      threshold !== null
        ? { label: "Alert threshold", value: formatCount(threshold), accent: false }
        : null,
    ].filter(
      (
        card,
      ): card is { label: string; value: string; accent: boolean } => Boolean(card),
    );
  }

  if (type === "revenue_drop") {
    const currency =
      typeof parsed.currency === "string" ? normalizeCurrencyCode(parsed.currency) : undefined;
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

    return [
      currentRevenue !== null
        ? {
            label: "Current revenue",
            value: formatMoneyAmount(currentRevenue, currency),
            accent: severityLabel === "High Severity",
          }
        : null,
      usualRevenue !== null
        ? {
            label: "Usual revenue",
            value: formatMoneyAmount(usualRevenue, currency),
            accent: false,
          }
        : null,
      threshold !== null
        ? {
            label: "Review threshold",
            value: formatMoneyAmount(threshold, currency),
            accent: false,
          }
        : null,
    ].filter(
      (
        card,
      ): card is { label: string; value: string; accent: boolean } => Boolean(card),
    );
  }

  return [];
}

function formatMetricLabel(label: string) {
  return label
    .replace("Current revenue", "Current<br/>revenue")
    .replace("Usual revenue", "Usual<br/>revenue")
    .replace("Review threshold", "Review<br/>threshold")
    .replace("Current failed payments", "Current failed<br/>payments")
    .replace("Usual failed payments", "Usual failed<br/>payments");
}

function buildEmailBrandHeader() {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr>
      <td valign="middle" style="padding:0 10px 0 0;">
        <img src="${EMAIL_BRAND_ICON_URL}" alt="" width="30" height="30" style="display:block;border:0;outline:none;text-decoration:none;width:30px;height:30px;object-fit:contain;" />
      </td>
      <td valign="middle" style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:30px;line-height:1;font-weight:800;letter-spacing:-0.06em;color:#0058bc;">
        Parveil
      </td>
    </tr>
  </table>`;
}

function buildHtmlEmail({
  accountLabel,
  alertType,
  severityLabel,
  detectedLabel,
  mainMessage,
  keyValues,
  metricCards,
  detailsUrl,
}: {
  accountLabel: string;
  alertType: string;
  severityLabel: string;
  detectedLabel: string;
  mainMessage: string;
  keyValues: string[];
  metricCards: Array<{ label: string; value: string; accent: boolean }>;
  detailsUrl: string | null;
}) {
  const isCritical = severityLabel === "High Severity";
  const badgeBg = isCritical ? "#ffdad6" : "#fff1c2";
  const badgeText = isCritical ? "#ba1a1a" : "#8a5a00";
  const accentBg = "#fbfcff";
  const cardBg = "#ffffff";
  const buttonHtml = detailsUrl
    ? `<div style="margin-top:22px;padding-top:16px;border-top:1px solid #f1f5f9;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;">
          <tr>
            <td style="background:#0058bc;border-radius:10px;text-align:center;vertical-align:middle;">
              <a href="${escapeHtml(detailsUrl)}" style="display:block;padding:12px 18px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;line-height:1;white-space:nowrap;">Review this alert</a>
            </td>
          </tr>
        </table>
      </div>`
    : "";
  const metricCardsHtml =
    metricCards.length > 0
      ? `<table role="presentation" width="94%" align="left" cellpadding="0" cellspacing="0" style="margin-top:16px;border-collapse:separate;border-spacing:10px 0;table-layout:fixed;">
          <tr>
            ${metricCards
              .map(
                (card) => `<td valign="top" style="width:${100 / metricCards.length}%;padding:0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;min-height:92px;border:1px solid rgba(193,198,215,0.18);border-radius:14px;background:${cardBg};">
                  <tr>
                    <td valign="top" style="padding:13px 11px 10px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                        <tr>
                          <td style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:10px;line-height:1.2;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#94a3b8;text-align:left;">
                            ${formatMetricLabel(escapeHtml(card.label))}
                          </td>
                        </tr>
                        <tr>
                          <td style="font-family:Inter,Arial,Helvetica,sans-serif;padding-top:10px;font-size:16px;line-height:1.05;color:${card.accent ? "#ba1a1a" : "#191c1d"};font-weight:800;letter-spacing:-0.03em;text-align:left;">
                            ${escapeHtml(card.value)}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>`,
              )
              .join("")}
          </tr>
        </table>`
      : keyValues.length > 0
        ? `<div style="margin-top:18px;">
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
    <div style="max-width:580px;margin:0 auto;">
      <div style="background:#ffffff;border:1px solid rgba(193,198,215,0.1);border-radius:24px;box-shadow:0 12px 32px rgba(25,28,29,0.04), 0 4px 8px rgba(25,28,29,0.02);overflow:hidden;">
        <div style="padding:26px 24px 26px;">
          <div style="padding-bottom:16px;margin-bottom:22px;border-bottom:1px solid #eef2f7;">
            ${buildEmailBrandHeader()}
          </div>
          <div style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:12px;line-height:1.2;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#717786;">Parveil alert</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:9px;border-collapse:collapse;">
            <tr>
              <td valign="top" style="padding:0 14px 0 0;">
                <div style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:21px;line-height:1.14;font-weight:800;letter-spacing:-0.04em;color:#191c1d;">${escapeHtml(alertType)}</div>
              </td>
              <td valign="top" align="right" style="white-space:nowrap;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;display:inline-table;">
                  <tr>
                    <td style="font-family:Inter,Arial,Helvetica,sans-serif;padding:7px 14px;border-radius:999px;background:${badgeBg};color:${badgeText};font-size:10px;font-weight:800;letter-spacing:0.1em;line-height:1;text-transform:uppercase;text-align:center;vertical-align:middle;white-space:nowrap;">
                      ${escapeHtml(severityLabel)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <div style="margin-top:20px;padding:16px;border-radius:18px;background:${accentBg};border:1px solid rgba(193,198,215,0.2);">
            <div style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:10px;line-height:1.2;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#94a3b8;">Connected account</div>
            <div style="font-family:Inter,Arial,Helvetica,sans-serif;margin-top:12px;font-size:17px;line-height:1.34;font-weight:800;letter-spacing:-0.04em;color:#191c1d;">${escapeHtml(accountLabel)}</div>
            <div style="font-family:Inter,Arial,Helvetica,sans-serif;display:block;margin-top:10px;font-size:13px;line-height:1.45;color:#5a6170;font-weight:700;"><strong style="color:#414755;">Detected:</strong> ${escapeHtml(detectedLabel)}</div>
          </div>
          <div style="margin-top:20px;">
            <div style="font-family:Inter,Arial,Helvetica,sans-serif;font-size:12px;line-height:1.2;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#717786;">Current issue</div>
            <div style="font-family:Inter,Arial,Helvetica,sans-serif;margin-top:10px;font-size:15px;line-height:1.58;color:#414755;">${escapeHtml(mainMessage)}</div>
          </div>
          ${metricCardsHtml}
          ${buttonHtml}
          <div style="font-family:Inter,Arial,Helvetica,sans-serif;margin-top:16px;font-size:12px;line-height:1.6;color:#717786;">
            This alert is informational only. Parveil does not predict future performance or recommend any action.
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
  const mainMessage = buildMainMessage(type, message, context);
  const alertTypeLabel = formatAlertType(type);
  const severityLabel = formatSeverity(severity);
  const detectedLabel = formatDetectedAt(resolvedDetectedAt);
  const metricCards = buildMetricCards(type, severityLabel, context);
  const html = buildHtmlEmail({
    accountLabel,
    alertType: alertTypeLabel,
    severityLabel,
    detectedLabel,
    mainMessage,
    keyValues,
    metricCards,
    detailsUrl,
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
      text: `Parveil monitoring update

This is an automated, informational alert from Parveil.

Account: ${accountLabel}
Alert type: ${alertTypeLabel}
Severity: ${severityLabel}
Detected: ${detectedLabel}

${mainMessage}${contextSection}${detailsUrl ? `\n\nReview this alert:\n${detailsUrl}` : ""}

Why you are receiving this:
- Parveil observed a sustained deviation from recent normal patterns.
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
