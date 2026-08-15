import { createClient } from "@libsql/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "@/generated/prisma/client";

let clientPromise: Promise<PrismaClient | null> | null = null;

function createAdapter(): unknown {
  const url = process.env.DATABASE_URL;
  if (url && url.startsWith("libsql://")) {
    return new PrismaLibSql({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
    } as never);
  }
  return new PrismaBetterSqlite3({ url: url ?? "file:./dev.db" });
}

// Live DB mode (migrate deploy + seed applied Aug 14). Probe re-runs on module recompile.
export function getPrisma(): Promise<PrismaClient | null> {
  if (!clientPromise) {
    clientPromise = (async () => {
      try {
        const client = new PrismaClient({ adapter: createAdapter() as never });
        await client.user.count();
        return client;
      } catch (err) {
        // Do NOT cache a failed probe - the DB may come up later (seeded while
        // the server runs). Reset so the next request re-probes and recovers.
        clientPromise = null;
        console.error("[db] probe failed, will retry on next request:", err);
        return null;
      }
    })();
  }
  return clientPromise;
}