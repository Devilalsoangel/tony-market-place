import { NextRequest, NextResponse } from "next/server";
import { getAppUser } from "@/lib/app-auth";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// Dedicated asset area for the entire app — local public/assets now, S3 bucket later.
// DB stores the returned http URL only; file:// never hits DB.
const ASSETS_DIR = path.join(process.cwd(), "public", "assets");

function ensureDir() {
  if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

// Magic-number sniffing: the client filename extension is attacker-controlled
// (malware.exe renamed photo.jpg sailed through as "jpg"). Only real image
// bytes are stored, with the extension derived from the bytes.
function sniffExt(buf: Buffer): string | null {
  const b = (i: number) => (i < buf.length ? buf[i] : -1);
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "jpg";
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return "png";
  if (b(0) === 0x47 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x38) return "gif";
  if (
    b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 &&
    b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50
  ) return "webp";
  return null;
}

// Public base URL for persisted asset URLs. NEVER the request Host header —
// Host is client-controlled, so building URLs from it lets an attacker mint
// trusted-looking rows pointing at their own domain (tracking pixels,
// content-swap after moderation). Configure APP_PUBLIC_BASE_URL in prod;
// local/dev falls back to loopback.
function publicBaseUrl(): string {
  const configured = (process.env.APP_PUBLIC_BASE_URL ?? "").trim().replace(/\/$/, "");
  if (configured) return configured;
  return "http://127.0.0.1:3000";
}

export async function POST(req: NextRequest) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form" }, { status: 400 });
  const file = form.get("file") as File | null;
  if (!file || typeof (file as any).arrayBuffer !== "function") {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "File too large (8MB max)" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) return NextResponse.json({ error: "Empty file" }, { status: 400 });
  const ext = sniffExt(buf);
  if (!ext) return NextResponse.json({ error: "Unsupported file type. Allowed: jpg, jpeg, png, webp, gif" }, { status: 415 });
  const id = crypto.randomUUID();
  const filename = `${id}.${ext}`;
  ensureDir();
  const outPath = path.join(ASSETS_DIR, filename);
  await fs.promises.writeFile(outPath, buf);

  // URL that hasRealImage() whitelists (127.0.0.1 / susej) and buyer can load.
  const url = `${publicBaseUrl()}/assets/${filename}`;

  return NextResponse.json({ ok: true, url }, { status: 201 });
}

export async function GET() {
  return NextResponse.json({ ok: true, assetDir: "/assets" });
}
