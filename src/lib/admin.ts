const FALLBACK_ADMIN_EMAILS = ["miguelaamaya97@gmail.com"];

function normalizeEmailList(value: string) {
  return value
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function getAdminEmails() {
  const configured = process.env.ADMIN_EMAILS?.trim();

  if (!configured) {
    return FALLBACK_ADMIN_EMAILS;
  }

  const parsed = normalizeEmailList(configured);
  return parsed.length > 0 ? parsed : FALLBACK_ADMIN_EMAILS;
}

export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  return getAdminEmails().includes(email.trim().toLowerCase());
}
