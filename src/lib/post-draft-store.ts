import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import type { PostDraftInput, PostDraftRecord } from "@/lib/post-drafts";

export async function listPostDrafts() {
  return prisma.$queryRaw<PostDraftRecord[]>(Prisma.sql`
    SELECT *
    FROM "PostDraft"
    ORDER BY "updatedAt" DESC, "createdAt" DESC
  `);
}

export async function findPostDraftById(id: string) {
  const rows = await prisma.$queryRaw<PostDraftRecord[]>(Prisma.sql`
    SELECT *
    FROM "PostDraft"
    WHERE "id" = ${id}
    LIMIT 1
  `);

  return rows[0] ?? null;
}

export async function createPostDraft(input: PostDraftInput) {
  const draftId = randomUUID();

  const rows = await prisma.$queryRaw<PostDraftRecord[]>(Prisma.sql`
    INSERT INTO "PostDraft" (
      "id",
      "title",
      "postType",
      "postText",
      "screenshotUrl",
      "screenshotNotes",
      "status"
    )
    VALUES (
      ${draftId},
      ${input.title},
      ${input.postType},
      ${input.postText ?? null},
      ${input.screenshotUrl ?? null},
      ${input.screenshotNotes ?? null},
      ${input.status ?? "draft"}
    )
    RETURNING *
  `);

  return rows[0];
}

export async function updatePostDraft(id: string, input: Partial<PostDraftInput>) {
  const assignments: Prisma.Sql[] = [];

  if (input.title !== undefined) assignments.push(Prisma.sql`"title" = ${input.title}`);
  if (input.postType !== undefined) assignments.push(Prisma.sql`"postType" = ${input.postType}`);
  if (input.postText !== undefined) assignments.push(Prisma.sql`"postText" = ${input.postText}`);
  if (input.screenshotUrl !== undefined) assignments.push(Prisma.sql`"screenshotUrl" = ${input.screenshotUrl}`);
  if (input.screenshotNotes !== undefined) {
    assignments.push(Prisma.sql`"screenshotNotes" = ${input.screenshotNotes}`);
  }
  if (input.status !== undefined) assignments.push(Prisma.sql`"status" = ${input.status}`);

  assignments.push(Prisma.sql`"updatedAt" = CURRENT_TIMESTAMP`);

  const rows = await prisma.$queryRaw<PostDraftRecord[]>(Prisma.sql`
    UPDATE "PostDraft"
    SET ${Prisma.join(assignments, ", ")}
    WHERE "id" = ${id}
    RETURNING *
  `);

  return rows[0] ?? null;
}
