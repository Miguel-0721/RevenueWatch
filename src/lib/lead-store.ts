import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import type { LeadCandidate, LeadRecord } from "@/lib/leads";

function sqlTextArray(values: string[]) {
  if (values.length === 0) {
    return Prisma.sql`ARRAY[]::TEXT[]`;
  }

  return Prisma.sql`ARRAY[${Prisma.join(values)}]::TEXT[]`;
}

export async function listLeads(filters: {
  source?: string;
  status?: string;
  likelyStripe?: string;
  pricingStatus?: string;
  minScore?: number;
}) {
  const conditions: Prisma.Sql[] = [];

  if (filters.source && filters.source !== "all") {
    conditions.push(Prisma.sql`"source" = ${filters.source}`);
  }

  if (filters.status && filters.status !== "all") {
    conditions.push(Prisma.sql`"status" = ${filters.status}`);
  }

  if (filters.likelyStripe && filters.likelyStripe !== "all") {
    conditions.push(Prisma.sql`"likelyStripe" = ${filters.likelyStripe}`);
  }

  if (filters.pricingStatus && filters.pricingStatus !== "all") {
    conditions.push(Prisma.sql`"pricingStatus" = ${filters.pricingStatus}`);
  }

  if (filters.minScore && filters.minScore > 0) {
    conditions.push(Prisma.sql`"score" >= ${filters.minScore}`);
  }

  const whereClause =
    conditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
      : Prisma.empty;

  return prisma.$queryRaw<LeadRecord[]>(Prisma.sql`
    SELECT *
    FROM "Lead"
    ${whereClause}
    ORDER BY "score" DESC, "updatedAt" DESC
  `);
}

export async function findLeadById(id: string) {
  const rows = await prisma.$queryRaw<LeadRecord[]>(Prisma.sql`
    SELECT *
    FROM "Lead"
    WHERE "id" = ${id}
    LIMIT 1
  `);

  return rows[0] ?? null;
}

export async function findDuplicateLead(candidate: LeadCandidate) {
  if (candidate.sourceUrl) {
    const sourceRows = await prisma.$queryRaw<LeadRecord[]>(Prisma.sql`
      SELECT *
      FROM "Lead"
      WHERE "sourceUrl" = ${candidate.sourceUrl}
      ORDER BY "updatedAt" DESC
      LIMIT 1
    `);

    if (sourceRows[0]) {
      return sourceRows[0];
    }
  }

  const secondaryValues = [candidate.profileUrl, candidate.postUrl, candidate.website]
    .filter(Boolean) as string[];
  const uniqueSecondaryValues = [...new Set(secondaryValues)];

  if (uniqueSecondaryValues.length > 0) {
    const fallbackRows = await prisma.$queryRaw<LeadRecord[]>(Prisma.sql`
      SELECT *
      FROM "Lead"
      WHERE
        "profileUrl" IN (${Prisma.join(uniqueSecondaryValues)}) OR
        "postUrl" IN (${Prisma.join(uniqueSecondaryValues)}) OR
        "website" IN (${Prisma.join(uniqueSecondaryValues)})
      ORDER BY "updatedAt" DESC
      LIMIT 1
    `);

    if (fallbackRows[0]) {
      return fallbackRows[0];
    }
  }

  if (candidate.website && candidate.productName) {
    const productRows = await prisma.$queryRaw<LeadRecord[]>(Prisma.sql`
      SELECT *
      FROM "Lead"
      WHERE "website" = ${candidate.website} AND "productName" = ${candidate.productName}
      ORDER BY "updatedAt" DESC
      LIMIT 1
    `);

    if (productRows[0]) {
      return productRows[0];
    }
  }

  if (candidate.productName) {
    const nameRows = await prisma.$queryRaw<LeadRecord[]>(Prisma.sql`
      SELECT *
      FROM "Lead"
      WHERE "productName" = ${candidate.productName}
      ORDER BY "updatedAt" DESC
      LIMIT 1
    `);

    return nameRows[0] ?? null;
  }

  return null;
}

export async function createLead(candidate: LeadCandidate) {
  const leadId = randomUUID();

  const rows = await prisma.$queryRaw<LeadRecord[]>(Prisma.sql`
    INSERT INTO "Lead" (
      "id",
      "name",
      "handle",
      "profileUrl",
      "productName",
      "website",
      "source",
      "sourceUrl",
      "location",
      "bio",
      "postText",
      "postUrl",
      "pricingStatus",
      "likelyStripe",
      "painSignals",
      "score",
      "scoreReasons",
      "status",
      "notes",
      "suggestedReply",
      "lastContactedAt"
    )
    VALUES (
      ${leadId},
      ${candidate.name},
      ${candidate.handle ?? null},
      ${candidate.profileUrl ?? null},
      ${candidate.productName ?? null},
      ${candidate.website ?? null},
      ${candidate.source},
      ${candidate.sourceUrl ?? null},
      ${candidate.location ?? null},
      ${candidate.bio ?? null},
      ${candidate.postText ?? null},
      ${candidate.postUrl ?? null},
      ${candidate.pricingStatus ?? "unknown"},
      ${candidate.likelyStripe ?? "unknown"},
      ${sqlTextArray(candidate.painSignals ?? [])},
      ${candidate.score ?? 0},
      ${sqlTextArray(candidate.scoreReasons ?? [])},
      ${candidate.status ?? "new"},
      ${candidate.notes ?? null},
      ${candidate.suggestedReply ?? null},
      ${candidate.lastContactedAt ?? null}
    )
    RETURNING *
  `);

  return rows[0];
}

export async function updateLead(id: string, data: Partial<LeadCandidate>) {
  const assignments: Prisma.Sql[] = [];

  if (data.name !== undefined) assignments.push(Prisma.sql`"name" = ${data.name}`);
  if (data.handle !== undefined) assignments.push(Prisma.sql`"handle" = ${data.handle}`);
  if (data.profileUrl !== undefined) assignments.push(Prisma.sql`"profileUrl" = ${data.profileUrl}`);
  if (data.productName !== undefined) assignments.push(Prisma.sql`"productName" = ${data.productName}`);
  if (data.website !== undefined) assignments.push(Prisma.sql`"website" = ${data.website}`);
  if (data.source !== undefined) assignments.push(Prisma.sql`"source" = ${data.source}`);
  if (data.sourceUrl !== undefined) assignments.push(Prisma.sql`"sourceUrl" = ${data.sourceUrl}`);
  if (data.location !== undefined) assignments.push(Prisma.sql`"location" = ${data.location}`);
  if (data.bio !== undefined) assignments.push(Prisma.sql`"bio" = ${data.bio}`);
  if (data.postText !== undefined) assignments.push(Prisma.sql`"postText" = ${data.postText}`);
  if (data.postUrl !== undefined) assignments.push(Prisma.sql`"postUrl" = ${data.postUrl}`);
  if (data.pricingStatus !== undefined) assignments.push(Prisma.sql`"pricingStatus" = ${data.pricingStatus}`);
  if (data.likelyStripe !== undefined) assignments.push(Prisma.sql`"likelyStripe" = ${data.likelyStripe}`);
  if (data.painSignals !== undefined) assignments.push(Prisma.sql`"painSignals" = ${sqlTextArray(data.painSignals)}`);
  if (data.score !== undefined) assignments.push(Prisma.sql`"score" = ${data.score}`);
  if (data.scoreReasons !== undefined) assignments.push(Prisma.sql`"scoreReasons" = ${sqlTextArray(data.scoreReasons)}`);
  if (data.status !== undefined) assignments.push(Prisma.sql`"status" = ${data.status}`);
  if (data.notes !== undefined) assignments.push(Prisma.sql`"notes" = ${data.notes}`);
  if (data.suggestedReply !== undefined) assignments.push(Prisma.sql`"suggestedReply" = ${data.suggestedReply}`);
  if (data.lastContactedAt !== undefined) {
    assignments.push(Prisma.sql`"lastContactedAt" = ${data.lastContactedAt ?? null}`);
  }

  assignments.push(Prisma.sql`"updatedAt" = CURRENT_TIMESTAMP`);

  const rows = await prisma.$queryRaw<LeadRecord[]>(Prisma.sql`
    UPDATE "Lead"
    SET ${Prisma.join(assignments, ", ")}
    WHERE "id" = ${id}
    RETURNING *
  `);

  return rows[0] ?? null;
}

export async function deleteLeadsByIds(ids: string[]) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  if (uniqueIds.length === 0) {
    return 0;
  }

  const deletedRows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    DELETE FROM "Lead"
    WHERE "id" IN (${Prisma.join(uniqueIds)})
    RETURNING "id"
  `);

  return deletedRows.length;
}

export async function clearSkippedLeads() {
  const deletedRows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    DELETE FROM "Lead"
    WHERE "status" = 'skipped'
    RETURNING "id"
  `);

  return deletedRows.length;
}

export async function clearAllLeads() {
  const deletedRows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    DELETE FROM "Lead"
    RETURNING "id"
  `);

  return deletedRows.length;
}

export async function listDiscoveredProductHuntLeads() {
  return prisma.$queryRaw<LeadRecord[]>(Prisma.sql`
    SELECT *
    FROM "Lead"
    WHERE "source" = 'product_hunt' AND "status" = 'new'
    ORDER BY "score" DESC, "updatedAt" DESC
  `);
}

export async function clearDiscoveredProductHuntLeads() {
  const deletedRows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    DELETE FROM "Lead"
    WHERE
      "source" = 'product_hunt' AND
      "status" = 'new'
    RETURNING "id"
  `);

  return deletedRows.length;
}
