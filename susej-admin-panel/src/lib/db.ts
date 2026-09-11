import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

let clientPromise: Promise<PrismaClient | null> | null = null;

function createAdapter(): unknown {
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith("postgres")) {
    // No silent SQLite fallback - a missing/bad DATABASE_URL must be loud,
    // not quietly spin up an empty demo database.
    throw new Error(
      "[db] DATABASE_URL is missing or not a postgres:// connection string. Configure PostgreSQL (see .env) before starting the server."
    );
  }
  return new PrismaPg({ connectionString: url });
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