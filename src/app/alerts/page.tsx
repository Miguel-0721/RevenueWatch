import { redirect } from "next/navigation";

type AlertsRedirectPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function toQueryString(
  params: Record<string, string | string[] | undefined> | undefined
) {
  if (!params) return "";

  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      query.set(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        query.append(key, entry);
      }
    }
  }

  const rendered = query.toString();
  return rendered ? `?${rendered}` : "";
}

export default async function AlertsRedirectPage({
  searchParams,
}: AlertsRedirectPageProps) {
  const params = searchParams ? await searchParams : undefined;
  redirect(`/dashboard/alerts${toQueryString(params)}`);
}
