export type DemoAlertType = "revenue_drop" | "payment_failed" | "none";
export type DemoSeverity = "high" | "review" | "none";
export type DemoStatus = "active_issue" | "healthy";

export type DemoRevenuePoint = {
  time: string;
  revenue: number;
};

export type DemoFailurePoint = {
  time: string;
  failures: number;
};

export type DemoAccount = {
  id: string;
  name: string;
  status: DemoStatus;
  alertType: DemoAlertType;
  severity: DemoSeverity;
  lastEvent: string;
  detectedAt?: string;
  usualRevenue?: number;
  currentRevenue?: number;
  alertThreshold?: number;
  normalFailures?: number;
  currentFailures?: number;
  message: string;
  cta?: string;
  revenueSeries?: DemoRevenuePoint[];
  failureSeries?: DemoFailurePoint[];
};

export type DemoAlertHistoryEntry = {
  accountName: string;
  type: Exclude<DemoAlertType, "none">;
  message: string;
  timestamp: string;
  group: "Today" | "Yesterday" | "Earlier this week" | "Last week" | "Older";
};

const DEMO_ID_ALIASES: Record<string, string> = {
  acct_demo_oak: "acct_demo_oak_ember",
};

export const demoAccounts: DemoAccount[] = [
  {
    id: "acct_demo_northstar",
    name: "Northstar Commerce",
    status: "active_issue",
    alertType: "revenue_drop",
    severity: "high",
    lastEvent: "6 days ago",
    detectedAt: "1 hour ago",
    usualRevenue: 112000,
    currentRevenue: 58000,
    alertThreshold: 75000,
    message: "Sales are 45% lower than usual for this window.",
    cta: "Review Issue",
    revenueSeries: [
      { time: "07:00", revenue: 109000 },
      { time: "08:00", revenue: 114000 },
      { time: "09:00", revenue: 111000 },
      { time: "10:00", revenue: 108000 },
      { time: "11:00", revenue: 62000 },
      { time: "12:00", revenue: 58000 },
    ],
  },
  {
    id: "acct_demo_bluepeak",
    name: "BluePeak Studio",
    status: "active_issue",
    alertType: "payment_failed",
    severity: "high",
    lastEvent: "6 days ago",
    detectedAt: "2 hours ago",
    normalFailures: 6,
    currentFailures: 14,
    message:
      "Payment failures are significantly higher than usual compared to recent activity.",
    cta: "Review Issue",
    failureSeries: [
      { time: "10:00", failures: 3 },
      { time: "11:00", failures: 7 },
      { time: "12:00", failures: 5 },
      { time: "13:00", failures: 8 },
      { time: "14:00", failures: 2 },
      { time: "15:00", failures: 14 },
    ],
  },
  {
    id: "acct_demo_cedar",
    name: "Cedar Labs",
    status: "active_issue",
    alertType: "revenue_drop",
    severity: "review",
    lastEvent: "6 days ago",
    detectedAt: "3 hours ago",
    usualRevenue: 84000,
    currentRevenue: 51000,
    alertThreshold: 55000,
    message: "Sales are 39% lower than usual for this window.",
    cta: "Review Issue",
    revenueSeries: [
      { time: "07:00", revenue: 82000 },
      { time: "08:00", revenue: 83500 },
      { time: "09:00", revenue: 80800 },
      { time: "10:00", revenue: 78200 },
      { time: "11:00", revenue: 56000 },
      { time: "12:00", revenue: 51000 },
    ],
  },
  {
    id: "acct_demo_harbor",
    name: "Harbor Retail",
    status: "active_issue",
    alertType: "payment_failed",
    severity: "review",
    lastEvent: "6 days ago",
    detectedAt: "4 hours ago",
    normalFailures: 5,
    currentFailures: 15,
    message: "Payment failures are higher than usual compared to recent activity.",
    cta: "Review Issue",
    failureSeries: [
      { time: "08:00", failures: 1 },
      { time: "09:00", failures: 2 },
      { time: "10:00", failures: 3 },
      { time: "11:00", failures: 4 },
      { time: "12:00", failures: 10 },
      { time: "13:00", failures: 15 },
    ],
  },
  {
    id: "acct_demo_oak_ember",
    name: "Oak & Ember",
    status: "healthy",
    alertType: "none",
    severity: "none",
    lastEvent: "10 hours ago",
    usualRevenue: 46000,
    currentRevenue: 44500,
    message: "Monitoring active",
    revenueSeries: [
      { time: "00:00", revenue: 44000 },
      { time: "01:00", revenue: 45500 },
      { time: "02:00", revenue: 46200 },
      { time: "03:00", revenue: 44800 },
      { time: "04:00", revenue: 47000 },
      { time: "05:00", revenue: 45800 },
      { time: "06:00", revenue: 46500 },
      { time: "07:00", revenue: 45200 },
      { time: "08:00", revenue: 44500 },
    ],
  },
  {
    id: "acct_demo_riverline",
    name: "Riverline Fitness",
    status: "healthy",
    alertType: "none",
    severity: "none",
    lastEvent: "9 hours ago",
    usualRevenue: 38000,
    currentRevenue: 39200,
    message: "Monitoring active",
    revenueSeries: [
      { time: "00:00", revenue: 37000 },
      { time: "01:00", revenue: 38200 },
      { time: "02:00", revenue: 39100 },
      { time: "03:00", revenue: 38600 },
      { time: "04:00", revenue: 39700 },
      { time: "05:00", revenue: 40200 },
      { time: "06:00", revenue: 39500 },
      { time: "07:00", revenue: 38900 },
      { time: "08:00", revenue: 39200 },
    ],
  },
  {
    id: "acct_demo_atlas",
    name: "Atlas Agency",
    status: "healthy",
    alertType: "none",
    severity: "none",
    lastEvent: "1 day ago",
    usualRevenue: 72000,
    currentRevenue: 73500,
    message: "Monitoring active",
  },
  {
    id: "acct_demo_meridian",
    name: "Meridian Goods",
    status: "healthy",
    alertType: "none",
    severity: "none",
    lastEvent: "1 day ago",
    usualRevenue: 59000,
    currentRevenue: 60200,
    message: "Monitoring active",
  },
  {
    id: "acct_demo_summit",
    name: "Summit Learning",
    status: "healthy",
    alertType: "none",
    severity: "none",
    lastEvent: "2 days ago",
    usualRevenue: 31000,
    currentRevenue: 31800,
    message: "Monitoring active",
  },
  {
    id: "acct_demo_lumen",
    name: "Lumen Health",
    status: "healthy",
    alertType: "none",
    severity: "none",
    lastEvent: "3 days ago",
    usualRevenue: 26500,
    currentRevenue: 27000,
    message: "Monitoring active",
  },
];

export const demoAlertHistory: DemoAlertHistoryEntry[] = [
  {
    accountName: "Summit Learning",
    type: "revenue_drop",
    message: "Revenue drop detected for Summit Learning",
    timestamp: "Yesterday, 4:00 PM",
    group: "Yesterday",
  },
  {
    accountName: "Meridian Goods",
    type: "payment_failed",
    message: "Payment failure spike detected for Meridian Goods",
    timestamp: "Yesterday, 12:00 PM",
    group: "Yesterday",
  },
  {
    accountName: "Atlas Agency",
    type: "revenue_drop",
    message: "Revenue drop detected for Atlas Agency",
    timestamp: "Yesterday, 8:00 AM",
    group: "Yesterday",
  },
  {
    accountName: "Oak & Ember",
    type: "payment_failed",
    message: "Payment failure spike detected for Oak & Ember",
    timestamp: "Apr 30, 5:00 PM",
    group: "Earlier this week",
  },
  {
    accountName: "Riverline Fitness",
    type: "revenue_drop",
    message: "Revenue drop detected for Riverline Fitness",
    timestamp: "Apr 30, 1:00 PM",
    group: "Earlier this week",
  },
  {
    accountName: "BluePeak Studio",
    type: "revenue_drop",
    message: "Revenue drop detected for BluePeak Studio",
    timestamp: "Apr 29, 2:00 PM",
    group: "Earlier this week",
  },
  {
    accountName: "Northstar Commerce",
    type: "payment_failed",
    message: "Payment failure spike detected for Northstar Commerce",
    timestamp: "Apr 29, 10:00 AM",
    group: "Earlier this week",
  },
  {
    accountName: "Harbor Retail",
    type: "revenue_drop",
    message: "Revenue drop detected for Harbor Retail",
    timestamp: "Apr 28, 3:00 PM",
    group: "Earlier this week",
  },
  {
    accountName: "Cedar Labs",
    type: "payment_failed",
    message: "Payment failure spike detected for Cedar Labs",
    timestamp: "Apr 28, 11:00 AM",
    group: "Earlier this week",
  },
  {
    accountName: "Meridian Goods",
    type: "revenue_drop",
    message: "Revenue drop detected for Meridian Goods",
    timestamp: "Apr 27, 4:00 PM",
    group: "Earlier this week",
  },
  {
    accountName: "Atlas Agency",
    type: "payment_failed",
    message: "Payment failure spike detected for Atlas Agency",
    timestamp: "Apr 27, 9:00 AM",
    group: "Earlier this week",
  },
  {
    accountName: "Lumen Health",
    type: "revenue_drop",
    message: "Revenue drop detected for Lumen Health",
    timestamp: "Apr 26, 2:00 PM",
    group: "Earlier this week",
  },
  {
    accountName: "Summit Learning",
    type: "payment_failed",
    message: "Payment failure spike detected for Summit Learning",
    timestamp: "Apr 26, 10:00 AM",
    group: "Earlier this week",
  },
  {
    accountName: "Riverline Fitness",
    type: "payment_failed",
    message: "Payment failure spike detected for Riverline Fitness",
    timestamp: "Apr 25, 12:00 PM",
    group: "Last week",
  },
];

function normalizeDemoId(id: string) {
  return DEMO_ID_ALIASES[id] ?? id;
}

function isRevenueDropAccount(account: DemoAccount) {
  return account.alertType === "revenue_drop" && typeof account.currentRevenue === "number" && typeof account.usualRevenue === "number";
}

function isPaymentFailedAccount(account: DemoAccount) {
  return account.alertType === "payment_failed" && typeof account.currentFailures === "number" && typeof account.normalFailures === "number";
}

function parseRelativeHoursAgo(input?: string) {
  if (!input) return Number.POSITIVE_INFINITY;
  const match = input.match(/(\d+)\s+hour/);
  if (match) return Number(match[1]);
  const minuteMatch = input.match(/(\d+)\s+minute/);
  if (minuteMatch) return Number(minuteMatch[1]) / 60;
  const dayMatch = input.match(/(\d+)\s+day/);
  if (dayMatch) return Number(dayMatch[1]) * 24;
  return Number.POSITIVE_INFINITY;
}

export function getRevenueDropPercent(currentRevenue: number, usualRevenue: number) {
  if (usualRevenue <= 0) return 0;
  return Math.round(((usualRevenue - currentRevenue) / usualRevenue) * 100);
}

export function getPaymentFailureMultiple(currentFailures: number, normalFailures: number) {
  if (normalFailures <= 0) return 0;
  return currentFailures / normalFailures;
}

export function getDemoSeverity(account: DemoAccount): DemoSeverity {
  if (isRevenueDropAccount(account)) {
    const dropPercent = getRevenueDropPercent(account.currentRevenue!, account.usualRevenue!);
    if (dropPercent >= 40) return "high";
    if (dropPercent >= 25) return "review";
    return "none";
  }

  if (isPaymentFailedAccount(account)) {
    const multiple = getPaymentFailureMultiple(account.currentFailures!, account.normalFailures!);
    if (multiple >= 4) return "high";
    if (multiple >= 2) return "review";
    return "none";
  }

  return "none";
}

export function getDemoAccountById(id: string) {
  const normalizedId = normalizeDemoId(id);
  return demoAccounts.find((account) => account.id === normalizedId) ?? null;
}

export function getActiveDemoAlerts() {
  return demoAccounts
    .filter((account) => account.status === "active_issue")
    .map((account) => ({
      ...account,
      severity: getDemoSeverity(account),
    }))
    .sort((left, right) => {
      const severityRank = { high: 0, review: 1, none: 2 } as const;
      const severityDifference = severityRank[left.severity] - severityRank[right.severity];
      if (severityDifference !== 0) return severityDifference;
      return parseRelativeHoursAgo(left.detectedAt) - parseRelativeHoursAgo(right.detectedAt);
    });
}

export function getDemoAlertHistory() {
  return demoAlertHistory;
}

export function getDemoDashboardStats() {
  return {
    connectedAccounts: demoAccounts.length,
    activeAlerts: getActiveDemoAlerts().length,
  };
}

export function hasDemoAccount(ids: string[]) {
  return ids.some((id) => getDemoAccountById(id) !== null);
}
