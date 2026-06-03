const EURO = "\u20AC";
const RIGHT_ARROW = "\u2192";

export const subscriptionHealthPreview = {
  overview: {
    activeSubscriptions: 428,
    estimatedMrr: `${EURO}18,420`,
    needsReview: 3,
    failedRenewals: 14,
    trialing: 32,
    pastDue: 9,
    unpaid: 4,
    canceled: "5 this week",
    netMovement: "+18 this month",
  },
  accounts: [
    {
      stripeAccountId: "preview-northstar",
      name: "Northstar Commerce",
      status: "Review needed",
      activeSubscriptions: 124,
      estimatedMrr: `${EURO}6,420`,
      activeAlerts: 1,
      lastActivity: "12m ago",
    },
    {
      stripeAccountId: "preview-bluepeak",
      name: "BluePeak Studio",
      status: "Monitoring active",
      activeSubscriptions: 88,
      estimatedMrr: `${EURO}3,900`,
      activeAlerts: 1,
      lastActivity: "45m ago",
    },
    {
      stripeAccountId: "preview-cedar",
      name: "Cedar Labs",
      status: "Attention needed",
      activeSubscriptions: 216,
      estimatedMrr: `${EURO}8,100`,
      activeAlerts: 1,
      lastActivity: "2h ago",
    },
  ],
  inboxSummary: {
    needsReview: 3,
    failedRenewals: 14,
    attentionNeeded: 1,
    reviewedRecently: 3,
  },
  issues: [
    {
      id: "preview-subscription-canceled",
      accountName: "Northstar Commerce",
      type: "subscription_canceled",
      typeLabel: "Subscription canceled",
      message:
        "A subscription was canceled. Parveil is monitoring the revenue impact and showing account context for review.",
      severityKind: "warning" as const,
      severityLabel: "Normal",
      severityTextColor: "#475569",
      severityBgColor: "#F8FAFC",
      typeColor: "#475569",
      detectedLabel: "12m ago",
      href: "/dashboard/accounts",
      createdAt: new Date("2026-06-01T11:18:00.000Z").toISOString(),
      context: JSON.stringify({
        estimatedMonthlyRevenue: 3900,
        currency: "EUR",
        status: "Canceled",
        planName: "Starter",
        detectedAt: "Today, 11:18 UTC",
      }),
    },
    {
      id: "preview-failed-renewal",
      accountName: "BluePeak Studio",
      type: "failed_renewal",
      typeLabel: "Failed renewal",
      message:
        "A subscription renewal payment failed. The subscription is now past due and the monthly amount is at risk. Parveil is monitoring the issue and showing account context for review.",
      severityKind: "warning" as const,
      severityLabel: "Review needed",
      severityTextColor: "#9a6700",
      severityBgColor: "#FFF7E6",
      typeColor: "#9a6700",
      detectedLabel: "45m ago",
      href: "/dashboard/accounts",
      createdAt: new Date("2026-06-01T14:32:00.000Z").toISOString(),
      context: JSON.stringify({
        amountDue: 3900,
        currency: "EUR",
        status: "Past due",
        planName: "Growth",
        recentActivity: [
          { label: "Payment attempt failed", time: "Today, 14:32 UTC" },
          { label: "Invoice created", time: "Today, 14:30 UTC" },
        ],
      }),
    },
    {
      id: "preview-subscription-drop",
      accountName: "Cedar Labs",
      type: "subscription_drop",
      typeLabel: "Subscription drop detected",
      message:
        "Active subscriptions dropped from 10 to 7. Parveil is showing the subscription movement so the account can be reviewed.",
      severityKind: "critical" as const,
      severityLabel: "Attention needed",
      severityTextColor: "#B42318",
      severityBgColor: "#FEF3F2",
      typeColor: "#B42318",
      detectedLabel: "2h ago",
      href: "/dashboard/accounts",
      createdAt: new Date("2026-06-01T13:05:00.000Z").toISOString(),
      context: JSON.stringify({
        previousActiveSubscriptions: 10,
        currentActiveSubscriptions: 7,
        dropPercent: -30,
        detectedAt: "Today, 13:05 UTC",
      }),
    },
  ],
  history: [
    {
      id: "preview-history-past-due",
      type: "past_due_increase",
      accountName: "BluePeak Studio",
      summary: "Past-due subscriptions increased from 0 to 2.",
      status: "Reviewed",
      time: "Yesterday, 16:20",
    },
    {
      id: "preview-history-unpaid",
      type: "unpaid_subscription",
      accountName: "Cedar Labs",
      summary: "2 subscriptions were marked unpaid.",
      status: "Reviewed",
      time: "Yesterday, 09:45",
    },
    {
      id: "preview-history-canceled",
      type: "subscription_canceled",
      accountName: "Northstar Commerce",
      summary: `A customer canceled a subscription. Estimated monthly revenue impact: ${EURO}39.`,
      status: "Reviewed",
      time: "May 21, 4:34 PM",
    },
  ],
  currentIssuesSummary: [
    "Subscription canceled",
    "Failed renewal",
    "Subscription drop detected",
  ],
};

export type PreviewAccountDetail = {
  slug: string;
  stripeAccountId: string;
  name: string;
  status: "Review needed" | "Monitoring active" | "Attention needed";
  lastActivity: string;
  activeSubscriptions: number;
  estimatedMrr: string;
  activeAlerts: number;
  trials: number;
  pastDue: number;
  unpaid: number;
  canceledThisWeek: number;
  failedRenewals: number;
  netSubscriptions: string;
  currentIssue: {
    id: string;
    type: "subscription_canceled" | "failed_renewal" | "subscription_drop";
    severity: "warning" | "critical";
    message: string;
    detectedLabel: string;
    impact: string;
  };
  history: Array<{
    id: string;
    type:
      | "subscription_canceled"
      | "failed_renewal"
      | "past_due_increase"
      | "unpaid_subscription"
      | "subscription_drop";
    message: string;
    timestamp: string;
  }>;
};

export const previewAccountDetails: Record<string, PreviewAccountDetail> = {
  "northstar-commerce": {
    slug: "northstar-commerce",
    stripeAccountId: "preview-northstar",
    name: "Northstar Commerce",
    status: "Review needed",
    lastActivity: "12m ago",
    activeSubscriptions: 124,
    estimatedMrr: `${EURO}6,420`,
    activeAlerts: 1,
    trials: 8,
    pastDue: 2,
    unpaid: 1,
    canceledThisWeek: 1,
    failedRenewals: 3,
    netSubscriptions: "+4 this month",
    currentIssue: {
      id: "preview-northstar-current-issue",
      type: "subscription_canceled",
      severity: "warning",
      message: `A customer canceled a subscription. Estimated monthly revenue impact: ${EURO}39.`,
      detectedLabel: "12m ago",
      impact: `${EURO}39 impact`,
    },
    history: [
      {
        id: "preview-northstar-history-canceled",
        type: "subscription_canceled",
        message: `A customer canceled a subscription. Estimated monthly revenue impact: ${EURO}39.`,
        timestamp: "12m ago",
      },
      {
        id: "preview-northstar-history-past-due",
        type: "past_due_increase",
        message: "Past-due subscriptions increased from 1 to 2.",
        timestamp: "Yesterday, 16:20",
      },
    ],
  },
  "bluepeak-studio": {
    slug: "bluepeak-studio",
    stripeAccountId: "preview-bluepeak",
    name: "BluePeak Studio",
    status: "Monitoring active",
    lastActivity: "45m ago",
    activeSubscriptions: 88,
    estimatedMrr: `${EURO}3,900`,
    activeAlerts: 1,
    trials: 6,
    pastDue: 4,
    unpaid: 1,
    canceledThisWeek: 2,
    failedRenewals: 8,
    netSubscriptions: "+6 this month",
    currentIssue: {
      id: "preview-bluepeak-current-issue",
      type: "failed_renewal",
      severity: "warning",
      message: `A subscription renewal payment failed. Monthly amount at risk: ${EURO}39.`,
      detectedLabel: "45m ago",
      impact: `${EURO}39 at risk`,
    },
    history: [
      {
        id: "preview-bluepeak-history-past-due",
        type: "past_due_increase",
        message: "Past-due subscriptions increased from 2 to 4.",
        timestamp: "Yesterday, 16:20",
      },
      {
        id: "preview-bluepeak-history-failed-renewal",
        type: "failed_renewal",
        message: `A subscription renewal payment failed. Monthly amount at risk: ${EURO}39.`,
        timestamp: "45m ago",
      },
    ],
  },
  "cedar-labs": {
    slug: "cedar-labs",
    stripeAccountId: "preview-cedar",
    name: "Cedar Labs",
    status: "Attention needed",
    lastActivity: "2h ago",
    activeSubscriptions: 216,
    estimatedMrr: `${EURO}8,100`,
    activeAlerts: 1,
    trials: 18,
    pastDue: 3,
    unpaid: 2,
    canceledThisWeek: 2,
    failedRenewals: 3,
    netSubscriptions: "+8 this month",
    currentIssue: {
      id: "preview-cedar-current-issue",
      type: "subscription_drop",
      severity: "critical",
      message: "Active subscriptions dropped from 10 to 7.",
      detectedLabel: "2h ago",
      impact: "10 -> 7 active",
    },
    history: [
      {
        id: "preview-cedar-history-unpaid",
        type: "unpaid_subscription",
        message: "2 subscriptions were marked unpaid.",
        timestamp: "Yesterday, 09:45",
      },
      {
        id: "preview-cedar-history-drop",
        type: "subscription_drop",
        message: "Active subscriptions dropped from 10 to 7.",
        timestamp: "2h ago",
      },
    ],
  },
};

export { EURO, RIGHT_ARROW };
