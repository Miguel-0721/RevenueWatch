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
      status: "Review needed",
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

export type PreviewAffectedSubscriptionType =
  | "active"
  | "failed-renewal"
  | "past-due"
  | "trialing"
  | "unpaid"
  | "canceled";

export type PreviewAffectedSubscriptionRow = {
  id: string;
  customerName: string;
  customerEmail: string;
  account: string;
  plan: string;
  impact: string;
  status: string;
  lastEvent: string;
  href: string;
};

type PreviewAffectedSubscriptionDataset = {
  title: string;
  subtitle: string;
  rows: PreviewAffectedSubscriptionRow[];
  helperNote?: string;
};

function previewAccountSlug(account: string) {
  return account
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function accountHref(account: string) {
  return `/dashboard/accounts/${previewAccountSlug(account)}?preview=subscription-health`;
}

function makeAffectedRow(
  id: string,
  customerName: string,
  customerEmail: string,
  account: string,
  plan: string,
  impact: string,
  status: string,
  lastEvent: string,
): PreviewAffectedSubscriptionRow {
  return {
    id,
    customerName,
    customerEmail,
    account,
    plan,
    impact,
    status,
    lastEvent,
    href: accountHref(account),
  };
}

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
    status: "Review needed",
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

const activeAffectedRows: PreviewAffectedSubscriptionRow[] = [
  makeAffectedRow("affected-active-1", "Jane Cooper", "jane@example.com", "BluePeak Studio", "Pro monthly", `${EURO}39 MRR`, "Active", "Started Apr 12"),
  makeAffectedRow("affected-active-2", "Noah Bennett", "noah@example.com", "Northstar Commerce", "Growth monthly", `${EURO}117 MRR`, "Active", "Started Mar 8"),
  makeAffectedRow("affected-active-3", "Mila Chen", "mila@example.com", "Cedar Labs", "Team monthly", `${EURO}420 MRR`, "Active", "Started Feb 21"),
  makeAffectedRow("affected-active-4", "Olivia Price", "olivia@example.com", "Cedar Labs", "Pro yearly", `${EURO}10 MRR`, "Active", "Started Jan 14"),
  makeAffectedRow("affected-active-5", "Luca Moretti", "luca@example.com", "Northstar Commerce", "Starter monthly", `${EURO}19 MRR`, "Active", "Started Apr 20"),
  makeAffectedRow("affected-active-6", "Harper Lee", "harper@example.com", "Cedar Labs", "Growth monthly", `${EURO}117 MRR`, "Active", "Started Mar 2"),
  makeAffectedRow("affected-active-7", "Ethan Walsh", "ethan@example.com", "BluePeak Studio", "Team monthly", `${EURO}117 MRR`, "Active", "Started Feb 28"),
  makeAffectedRow("affected-active-8", "Sofia Nguyen", "sofia@example.com", "Northstar Commerce", "Pro monthly", `${EURO}39 MRR`, "Active", "Started Jan 30"),
  makeAffectedRow("affected-active-9", "Daniel Reed", "daniel@example.com", "Cedar Labs", "Pro yearly", `${EURO}35 MRR`, "Active", "Started Jan 7"),
  makeAffectedRow("affected-active-10", "Ava Mitchell", "ava@example.com", "Cedar Labs", "Growth monthly", `${EURO}117 MRR`, "Active", "Started Apr 4"),
  makeAffectedRow("affected-active-11", "Nina Torres", "nina@example.com", "Northstar Commerce", "Team monthly", `${EURO}117 MRR`, "Active", "Started Mar 14"),
  makeAffectedRow("affected-active-12", "Henry Sullivan", "henry@example.com", "Cedar Labs", "Pro monthly", `${EURO}39 MRR`, "Active", "Started Feb 16"),
  makeAffectedRow("affected-active-13", "Grace Patel", "grace@example.com", "Cedar Labs", "Starter monthly", `${EURO}19 MRR`, "Active", "Started Jan 11"),
  makeAffectedRow("affected-active-14", "Lucas Hart", "lucas@example.com", "Northstar Commerce", "Pro monthly", `${EURO}39 MRR`, "Active", "Started Apr 8"),
  makeAffectedRow("affected-active-15", "Emma Brooks", "emma@example.com", "Cedar Labs", "Growth yearly", `${EURO}9 MRR`, "Active", "Started Mar 25"),
  makeAffectedRow("affected-active-16", "Jack Morrison", "jack@example.com", "BluePeak Studio", "Pro monthly", `${EURO}39 MRR`, "Active", "Started Feb 4"),
  makeAffectedRow("affected-active-17", "Mason Rivera", "mason@example.com", "Northstar Commerce", "Team monthly", `${EURO}117 MRR`, "Active", "Started Jan 19"),
  makeAffectedRow("affected-active-18", "Chloe Bennett", "chloe@example.com", "Cedar Labs", "Starter monthly", `${EURO}19 MRR`, "Active", "Started Apr 17"),
  makeAffectedRow("affected-active-19", "Leo Carter", "leo@example.com", "BluePeak Studio", "Growth monthly", `${EURO}117 MRR`, "Active", "Started Mar 12"),
  makeAffectedRow("affected-active-20", "Zoe Marshall", "zoe@example.com", "Cedar Labs", "Pro yearly", `${EURO}33 MRR`, "Active", "Started Feb 9"),
];

const failedRenewalAffectedRows: PreviewAffectedSubscriptionRow[] = [
  makeAffectedRow("affected-failed-renewal-1", "Jane Cooper", "jane@example.com", "BluePeak Studio", "Pro monthly", `${EURO}39 at risk`, "Failed renewal", "45m ago"),
  makeAffectedRow("affected-failed-renewal-2", "Noah Bennett", "billing@northstar.example", "Northstar Commerce", "Growth monthly", `${EURO}117 at risk`, "Failed renewal", "2h ago"),
  makeAffectedRow("affected-failed-renewal-3", "Mila Chen", "subscriptions@cedarlabs.example", "Cedar Labs", "Team monthly", `${EURO}117 at risk`, "Failed renewal", "Yesterday, 09:40"),
  makeAffectedRow("affected-failed-renewal-4", "Olivia Price", "finance@bluepeak.example", "BluePeak Studio", "Team monthly", `${EURO}117 at risk`, "Failed renewal", "Yesterday, 16:20"),
  makeAffectedRow("affected-failed-renewal-5", "Lucas Hart", "ops@cedarlabs.example", "Cedar Labs", "Pro monthly", `${EURO}39 at risk`, "Failed renewal", "May 20, 11:15 AM"),
  makeAffectedRow("affected-failed-renewal-6", "Emma Brooks", "growth@northstar.example", "Northstar Commerce", "Growth monthly", `${EURO}117 at risk`, "Failed renewal", "May 18, 9:10 AM"),
  makeAffectedRow("affected-failed-renewal-7", "Sofia Nguyen", "accounts@cedarlabs.example", "Cedar Labs", "Team monthly", `${EURO}117 at risk`, "Failed renewal", "May 17, 4:22 PM"),
  makeAffectedRow("affected-failed-renewal-8", "Ethan Walker", "ethan@example.com", "Northstar Commerce", "Pro yearly", `${EURO}420 at risk`, "Failed renewal", "May 16, 3:08 PM"),
  makeAffectedRow("affected-failed-renewal-9", "Grace Patel", "grace@example.com", "BluePeak Studio", "Pro monthly", `${EURO}39 at risk`, "Failed renewal", "May 15, 10:31 AM"),
  makeAffectedRow("affected-failed-renewal-10", "Ava Mitchell", "ava@example.com", "BluePeak Studio", "Growth monthly", `${EURO}117 at risk`, "Failed renewal", "May 14, 8:54 AM"),
  makeAffectedRow("affected-failed-renewal-11", "Daniel Reed", "daniel@example.com", "BluePeak Studio", "Team yearly", `${EURO}210 at risk`, "Failed renewal", "May 13, 2:44 PM"),
  makeAffectedRow("affected-failed-renewal-12", "Nina Torres", "nina@example.com", "BluePeak Studio", "Starter monthly", `${EURO}19 at risk`, "Failed renewal", "May 12, 11:18 AM"),
  makeAffectedRow("affected-failed-renewal-13", "Liam Foster", "liam@example.com", "BluePeak Studio", "Pro monthly", `${EURO}39 at risk`, "Failed renewal", "May 11, 5:03 PM"),
  makeAffectedRow("affected-failed-renewal-14", "Henry Sullivan", "henry@example.com", "BluePeak Studio", "Team monthly", `${EURO}117 at risk`, "Failed renewal", "May 10, 9:42 AM"),
];

const pastDueAffectedRows: PreviewAffectedSubscriptionRow[] = [
  makeAffectedRow("affected-past-due-1", "Olivia Price", "finance@bluepeak.example", "BluePeak Studio", "Team monthly", `${EURO}117 at risk`, "Past due", "Yesterday, 16:20"),
  makeAffectedRow("affected-past-due-2", "Lucas Hart", "ops@cedarlabs.example", "Cedar Labs", "Pro monthly", `${EURO}39 at risk`, "Past due", "May 20, 11:15 AM"),
  makeAffectedRow("affected-past-due-3", "Emma Brooks", "growth@northstar.example", "Northstar Commerce", "Growth monthly", `${EURO}117 at risk`, "Past due", "May 18, 9:10 AM"),
  makeAffectedRow("affected-past-due-4", "Mason Rivera", "mason@example.com", "BluePeak Studio", "Pro yearly", `${EURO}39 at risk`, "Past due", "May 17, 1:12 PM"),
  makeAffectedRow("affected-past-due-5", "Sarah Miller", "sarah@example.com", "Cedar Labs", "Team monthly", `${EURO}117 at risk`, "Past due", "May 16, 4:40 PM"),
  makeAffectedRow("affected-past-due-6", "Jack Morrison", "jack@example.com", "Northstar Commerce", "Starter monthly", `${EURO}19 at risk`, "Past due", "May 15, 9:55 AM"),
  makeAffectedRow("affected-past-due-7", "Chloe Bennett", "chloe@example.com", "BluePeak Studio", "Growth monthly", `${EURO}117 at risk`, "Past due", "May 14, 6:24 PM"),
  makeAffectedRow("affected-past-due-8", "Leo Carter", "leo@example.com", "Cedar Labs", "Pro monthly", `${EURO}39 at risk`, "Past due", "May 13, 3:06 PM"),
  makeAffectedRow("affected-past-due-9", "Zoe Marshall", "zoe@example.com", "BluePeak Studio", "Pro yearly", `${EURO}420 at risk`, "Past due", "May 12, 10:48 AM"),
];

const trialingAffectedRows: PreviewAffectedSubscriptionRow[] = [
  makeAffectedRow("affected-trialing-1", "Sarah Miller", "sarah@example.com", "BluePeak Studio", "Pro monthly", "Trial ends May 28", "Trialing", "3 days left"),
  makeAffectedRow("affected-trialing-2", "Daniel Reed", "daniel@example.com", "Cedar Labs", "Team monthly", "Trial ends Jun 2", "Trialing", "8 days left"),
  makeAffectedRow("affected-trialing-3", "Nina Torres", "nina@example.com", "Northstar Commerce", "Growth monthly", "Trial ends Jun 6", "Trialing", "12 days left"),
  makeAffectedRow("affected-trialing-4", "Ava Mitchell", "ava@example.com", "BluePeak Studio", "Starter monthly", "Trial ends May 30", "Trialing", "5 days left"),
  makeAffectedRow("affected-trialing-5", "Luca Moretti", "luca@example.com", "Cedar Labs", "Pro monthly", "Trial ends Jun 4", "Trialing", "10 days left"),
  makeAffectedRow("affected-trialing-6", "Grace Patel", "grace@example.com", "Northstar Commerce", "Team monthly", "Trial ends Jun 1", "Trialing", "7 days left"),
  makeAffectedRow("affected-trialing-7", "Emma Brooks", "emma@example.com", "BluePeak Studio", "Growth monthly", "Trial ends May 29", "Trialing", "4 days left"),
  makeAffectedRow("affected-trialing-8", "Henry Sullivan", "henry@example.com", "Cedar Labs", "Starter monthly", "Trial ends Jun 3", "Trialing", "9 days left"),
  makeAffectedRow("affected-trialing-9", "Mila Chen", "mila@example.com", "Northstar Commerce", "Pro monthly", "Trial ends Jun 7", "Trialing", "13 days left"),
  makeAffectedRow("affected-trialing-10", "Noah Bennett", "noah@example.com", "Cedar Labs", "Team monthly", "Trial ends May 31", "Trialing", "6 days left"),
  makeAffectedRow("affected-trialing-11", "Olivia Price", "olivia@example.com", "Cedar Labs", "Growth monthly", "Trial ends Jun 5", "Trialing", "11 days left"),
  makeAffectedRow("affected-trialing-12", "Lucas Hart", "lucas@example.com", "Northstar Commerce", "Starter monthly", "Trial ends Jun 8", "Trialing", "14 days left"),
  makeAffectedRow("affected-trialing-13", "Sofia Nguyen", "sofia@example.com", "BluePeak Studio", "Pro monthly", "Trial ends May 27", "Trialing", "2 days left"),
  makeAffectedRow("affected-trialing-14", "Ethan Walker", "ethan@example.com", "Cedar Labs", "Team monthly", "Trial ends Jun 9", "Trialing", "15 days left"),
  makeAffectedRow("affected-trialing-15", "Liam Foster", "liam@example.com", "Northstar Commerce", "Growth monthly", "Trial ends Jun 10", "Trialing", "16 days left"),
  makeAffectedRow("affected-trialing-16", "Mason Rivera", "mason@example.com", "Cedar Labs", "Starter monthly", "Trial ends May 26", "Trialing", "1 day left"),
  makeAffectedRow("affected-trialing-17", "Chloe Bennett", "chloe@example.com", "Cedar Labs", "Pro monthly", "Trial ends Jun 11", "Trialing", "17 days left"),
  makeAffectedRow("affected-trialing-18", "Leo Carter", "leo@example.com", "Northstar Commerce", "Team monthly", "Trial ends Jun 12", "Trialing", "18 days left"),
  makeAffectedRow("affected-trialing-19", "Zoe Marshall", "zoe@example.com", "BluePeak Studio", "Growth monthly", "Trial ends Jun 13", "Trialing", "19 days left"),
  makeAffectedRow("affected-trialing-20", "Harper Lee", "harper@example.com", "Cedar Labs", "Starter monthly", "Trial ends Jun 14", "Trialing", "20 days left"),
  makeAffectedRow("affected-trialing-21", "Jack Morrison", "jack@example.com", "Northstar Commerce", "Pro monthly", "Trial ends Jun 15", "Trialing", "21 days left"),
  makeAffectedRow("affected-trialing-22", "Ivy Collins", "ivy@example.com", "Cedar Labs", "Team monthly", "Trial ends Jun 16", "Trialing", "22 days left"),
  makeAffectedRow("affected-trialing-23", "Owen Diaz", "owen@example.com", "Cedar Labs", "Growth monthly", "Trial ends Jun 17", "Trialing", "23 days left"),
  makeAffectedRow("affected-trialing-24", "Ruby Hayes", "ruby@example.com", "Cedar Labs", "Starter monthly", "Trial ends Jun 18", "Trialing", "24 days left"),
  makeAffectedRow("affected-trialing-25", "Caleb Ross", "caleb@example.com", "Cedar Labs", "Pro monthly", "Trial ends Jun 19", "Trialing", "25 days left"),
  makeAffectedRow("affected-trialing-26", "Maya Brooks", "maya@example.com", "Cedar Labs", "Team monthly", "Trial ends Jun 20", "Trialing", "26 days left"),
  makeAffectedRow("affected-trialing-27", "Wyatt Perry", "wyatt@example.com", "Northstar Commerce", "Growth monthly", "Trial ends Jun 21", "Trialing", "27 days left"),
  makeAffectedRow("affected-trialing-28", "Layla Kim", "layla@example.com", "Cedar Labs", "Starter monthly", "Trial ends Jun 22", "Trialing", "28 days left"),
  makeAffectedRow("affected-trialing-29", "Isaac Ward", "isaac@example.com", "Cedar Labs", "Pro monthly", "Trial ends Jun 23", "Trialing", "29 days left"),
  makeAffectedRow("affected-trialing-30", "Nora James", "nora@example.com", "Cedar Labs", "Team monthly", "Trial ends Jun 24", "Trialing", "30 days left"),
  makeAffectedRow("affected-trialing-31", "Julian Scott", "julian@example.com", "BluePeak Studio", "Growth monthly", "Trial ends Jun 25", "Trialing", "31 days left"),
  makeAffectedRow("affected-trialing-32", "Ella Morgan", "ella@example.com", "Cedar Labs", "Starter monthly", "Trial ends Jun 26", "Trialing", "32 days left"),
];

const unpaidAffectedRows: PreviewAffectedSubscriptionRow[] = [
  makeAffectedRow("affected-unpaid-1", "Sofia Nguyen", "accounts@cedarlabs.example", "Cedar Labs", "Team monthly", `${EURO}117 at risk`, "Unpaid", "Yesterday, 09:45"),
  makeAffectedRow("affected-unpaid-2", "Ethan Walker", "billing@northstar.example", "Northstar Commerce", "Pro yearly", `${EURO}420 at risk`, "Unpaid", "May 19, 3:20 PM"),
  makeAffectedRow("affected-unpaid-3", "Grace Patel", "finance@bluepeak.example", "BluePeak Studio", "Pro monthly", `${EURO}39 at risk`, "Unpaid", "May 17, 2:18 PM"),
  makeAffectedRow("affected-unpaid-4", "Liam Foster", "ops@cedarlabs.example", "Cedar Labs", "Pro monthly", `${EURO}39 at risk`, "Unpaid", "May 15, 10:08 AM"),
];

const canceledAffectedRows: PreviewAffectedSubscriptionRow[] = [
  makeAffectedRow("affected-canceled-1", "Liam Foster", "ops@cedarlabs.example", "Cedar Labs", "Team monthly", `${EURO}420 MRR impact`, "Canceled", "May 21, 4:34 PM"),
  makeAffectedRow("affected-canceled-2", "Ava Mitchell", "finance@bluepeak.example", "BluePeak Studio", "Pro monthly", `${EURO}39 MRR impact`, "Canceled", "May 17, 2:18 PM"),
  makeAffectedRow("affected-canceled-3", "Henry Sullivan", "accounts@northstar.example", "Northstar Commerce", "Growth monthly", `${EURO}117 MRR impact`, "Canceled", "May 15, 10:42 AM"),
  makeAffectedRow("affected-canceled-4", "Mason Rivera", "mason@example.com", "BluePeak Studio", "Starter monthly", `${EURO}19 MRR impact`, "Canceled", "May 14, 1:27 PM"),
  makeAffectedRow("affected-canceled-5", "Chloe Bennett", "chloe@example.com", "Cedar Labs", "Pro monthly", `${EURO}39 MRR impact`, "Canceled", "May 12, 9:36 AM"),
];

export const previewAffectedSubscriptions: Record<
  PreviewAffectedSubscriptionType,
  PreviewAffectedSubscriptionDataset
> = {
  active: {
    title: "Active subscriptions",
    subtitle: "Currently active paid subscriptions across connected Stripe accounts.",
    rows: activeAffectedRows,
    helperNote: "Showing 20 sample subscriptions from 428 active subscriptions.",
  },
  "failed-renewal": {
    title: "Failed renewals",
    subtitle: "Subscriptions with failed renewal payments across connected Stripe accounts.",
    rows: failedRenewalAffectedRows,
  },
  "past-due": {
    title: "Past-due subscriptions",
    subtitle: "Subscriptions currently marked past due across connected Stripe accounts.",
    rows: pastDueAffectedRows,
  },
  trialing: {
    title: "Trialing subscriptions",
    subtitle: "Subscriptions currently in trial across connected Stripe accounts.",
    rows: trialingAffectedRows,
  },
  unpaid: {
    title: "Unpaid subscriptions",
    subtitle: "Subscriptions marked unpaid across connected Stripe accounts.",
    rows: unpaidAffectedRows,
  },
  canceled: {
    title: "Canceled subscriptions",
    subtitle: "Recently canceled subscriptions across connected Stripe accounts.",
    rows: canceledAffectedRows,
  },
};

export { EURO, RIGHT_ARROW };
