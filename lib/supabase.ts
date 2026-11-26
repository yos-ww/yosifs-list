/**
 * Talking to the Supabase database from the browser.
 * The URL and publishable key are PUBLIC by design (safe to ship in the page);
 * Row Level Security in the database only allows reading. The secret key never lives here.
 */
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://tayeprbksqdopengwbfh.supabase.co";
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_gJ1JtTAexp32ZqAiWTWaKA_RCU4lc8t";

const headers = { apikey: SUPABASE_KEY, "Content-Type": "application/json" };

async function check(res: Response) {
  if (!res.ok) throw new Error(`Database error ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Read rows from a table, e.g. select("stores", "id,name"). */
export async function select<T>(table: string, columns: string, signal?: AbortSignal): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${columns}`, { headers, signal });
  return check(res);
}

/** Call a database function, e.g. rpc("search_list", { queries: ["milk"] }). */
export async function rpc<T>(fn: string, args: object, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers,
    body: JSON.stringify(args),
    signal,
  });
  return check(res);
}
