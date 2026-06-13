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
    if (!p.has("pgbouncer")) p.set("pgbouncer", "true");
    // Serverless: 1 connection per instance is correct (pgbouncer multiplexes).
    // 5 connections per instance was exhausting Supabase's pool under any load.
    p.set("connection_limit", process.env.DB_CONNECTION_LIMIT ?? "1");
    // Must be well under Netlify's 10s function timeout so a pool-pressure
    // spike returns a clean error instead of a 504 (Netlify kills at ~10s;
    // the old value of 20s guaranteed a 504 every time the pool was busy).
    p.set("pool_timeout", process.env.DB_POOL_TIMEOUT ?? "5");
    if (!p.has("connect_timeout")) p.set("connect_timeout", "5");
    return url.toString();
  } catch {
    return raw;
  }
}

// Connection-level Prisma error codes that mean "we never got a working
// connection" — safe to retry because the query never actually ran.
//   P2024 pool timeout · P1001/P1002 can't reach DB · P1008 op timeout ·
//   P1017 server closed the connection.
const RETRYABLE = new Set(["P2024", "P1001", "P1002", "P1008", "P1017"]);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function makeClient() {
  return new PrismaClient({ datasourceUrl: tunedDatabaseUrl() }).$extends({
    name: "retry-transient-connection-errors",
    query: {
      // Wrap EVERY query (models + raw) so a brief pool/connection blip
      // self-heals instead of bubbling up as a failed save or a failed
      // registration. Only connection-acquisition errors are retried, so we
      // never double-run a statement that already executed.
      async $allOperations({ args, query }) {
        let lastErr: unknown;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            return await query(args);
          } catch (e) {
            const code = (e as { code?: string })?.code;
            if (!code || !RETRYABLE.has(code)) throw e;
            lastErr = e;
            await wait(150 * (attempt + 1)); // 150ms, 300ms backoff
          }
        }
        throw lastErr;
      },
    },
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof makeClient> };

export const prisma = globalForPrisma.prisma ?? makeClient();

// Reuse the same client across hot reloads (dev) and warm invocations
// (serverless prod) so we never leak extra connections to the pooler.
globalForPrisma.prisma = prisma;

export default prisma;
