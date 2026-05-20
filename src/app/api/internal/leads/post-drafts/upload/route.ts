import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getLeadsAdminSession } from "@/lib/leads-auth";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function getExtensionFromType(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/jpeg") return "jpg";
  if (type === "image/webp") return "webp";
  return null;
}

export async function POST(request: Request) {
  const session = await getLeadsAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Screenshot file is required." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unsupported file type. Use png, jpg/jpeg, or webp.",
      },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      {
        ok: false,
        error: "Screenshot is too large. The max size is 5MB.",
      },
      { status: 400 }
    );
  }

  const extension = getExtensionFromType(file.type);
  if (!extension) {
    return NextResponse.json({ ok: false, error: "Could not determine file extension." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = `${randomUUID()}.${extension}`;
  const relativeDirectory = path.join("uploads", "post-drafts");
  const absoluteDirectory = path.join(process.cwd(), "public", relativeDirectory);
  const absolutePath = path.join(absoluteDirectory, fileName);

  await mkdir(absoluteDirectory, { recursive: true });
  await writeFile(absolutePath, buffer);

  return NextResponse.json({
    ok: true,
    screenshotUrl: `/${relativeDirectory.replace(/\\/g, "/")}/${fileName}`,
    fileName,
    size: file.size,
  });
}
