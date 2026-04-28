import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let sqlClient: NeonQueryFunction<false, false> | null = null;

export function getSqlClient() {
  if (typeof window !== "undefined") {
    throw new Error("Database client can only be used on the server.");
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing in the server environment.");
  }

  sqlClient ??= neon(databaseUrl);

  return sqlClient;
}
