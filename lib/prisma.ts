import { PrismaClient } from "@prisma/client";

// Tune the runtime (pooled) connection string for serverless + Supabase.
//
// On Netlify each warm function instance reuses one PrismaClient, but a
// single instance can serve several concurrent requests. With the Supabase
// transaction pooler (pgbouncer, port 6543) the prod URL defaults to
// connection_limit=1, so two simultaneous saves fight over one connection
// and the loser dies after 10s with P2024 "Timed out fetching a connection
// from the pool". We give each instance a small-but-real pool and more
// grace before giving up. All three knobs are env-overridable so you can
// tune them on Netlify without a code change.
function tunedDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    const p = url.searchParams;
    // pgbouncer transaction mode can't use cached prepared statements.
    if (!p.has("pgbouncer")) p.set("pgbouncer", "true");
    // A handful of connections per instance kills the contention that was
    // causing P2024, while staying well under the pooler's ceiling.
    p.set("connection_limit", process.env.DB_CONNECTION_LIMIT ?? "5");
    // Wait longer for a free connection before erroring (was 10s).
    p.set("pool_timeout", process.env.DB_POOL_TIMEOUT ?? "20");
    // Cap how long we wait to open a brand-new connection too.
    if (!p.has("connect_timeout")) p.set("connect_timeout", "15");
    return url.toString();
  } catch {
    // If DATABASE_URL isn't a parseable URL, fall back to it untouched.
    return raw;
  }
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ datasourceUrl: tunedDatabaseUrl() });

// Reuse the same client across hot reloads (dev) and warm invocations
// (serverless prod) so we never leak extra connections to the pooler.
globalForPrisma.prisma = prisma;

export default prisma;
