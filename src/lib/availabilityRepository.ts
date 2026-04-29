import { getSqlClient } from "@/lib/db";

interface BlockedTimeRow {
  time: string;
}

function normalizeTime(value: string) {
  return value.slice(0, 5);
}

function normalizeReason(reason: string | undefined) {
  const trimmedReason = reason?.trim();

  return trimmedReason || null;
}

export async function getBlockedTimesForDate(date: string): Promise<string[]> {
  const sql = getSqlClient();
  const rows = (await sql`
    SELECT to_char(block_time, 'HH24:MI') AS time
    FROM availability_blocks
    WHERE block_date = ${date}::date
    ORDER BY block_time ASC
  `) as BlockedTimeRow[];

  return rows.map((row) => normalizeTime(row.time));
}

export async function setSlotBlocked(
  date: string,
  time: string,
  reason?: string,
): Promise<void> {
  const sql = getSqlClient();
  const normalizedReason = normalizeReason(reason);

  await sql`
    INSERT INTO availability_blocks (
      block_date,
      block_time,
      reason
    )
    VALUES (
      ${date}::date,
      ${time}::time,
      ${normalizedReason}
    )
    ON CONFLICT (block_date, block_time)
    DO UPDATE SET
      reason = EXCLUDED.reason,
      updated_at = now()
  `;
}

export async function setSlotOpen(
  date: string,
  time: string,
): Promise<void> {
  const sql = getSqlClient();

  await sql`
    DELETE FROM availability_blocks
    WHERE block_date = ${date}::date
      AND block_time = ${time}::time
  `;
}
