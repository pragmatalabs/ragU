// Lightweight PostgreSQL client for gateway (logging, admin queries)
const POSTGRES_URL =
  process.env.POSTGRES_URL ||
  `postgresql://${process.env.POSTGRES_USER || "ragu"}:${process.env.POSTGRES_PASSWORD || "ragu_local"}@${process.env.POSTGRES_HOST || "localhost"}:${process.env.POSTGRES_PORT || "5438"}/${process.env.POSTGRES_DB || "ragu"}`;

async function query(sql: string, params: unknown[] = []): Promise<unknown[]> {
  const { Client } = await import("pg");
  const client = new Client({ connectionString: POSTGRES_URL });
  try {
    await client.connect();
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    await client.end();
  }
}

export async function logInteraction(data: {
  session_id: string;
  question: string;
  answer: string;
  model: string;
  provider: string;
  rag_enabled: boolean;
  collection: string;
  sources_count: number;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO interaction_log (session_id, question, answer, model, provider, rag_enabled, collection, sources_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        data.session_id,
        data.question,
        data.answer,
        data.model,
        data.provider,
        data.rag_enabled,
        data.collection,
        data.sources_count,
      ]
    );
  } catch (err) {
    console.error("Failed to log interaction:", err);
  }
}

export async function getInteractions(
  page: number,
  limit: number,
  search?: string
): Promise<{ items: unknown[]; total: number }> {
  const offset = (page - 1) * limit;
  const where = search
    ? "WHERE question ILIKE $3 OR answer ILIKE $3"
    : "";
  const params = search
    ? [limit, offset, `%${search}%`]
    : [limit, offset];

  const items = await query(
    `SELECT * FROM interaction_log ${where} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    params
  );
  const countResult = (await query(
    `SELECT COUNT(*) as total FROM interaction_log ${where}`,
    search ? [`%${search}%`] : []
  )) as { total: string }[];

  return { items, total: parseInt(countResult[0]?.total || "0") };
}

export async function getInteractionStats(): Promise<{
  total: number;
  today: number;
  thisWeek: number;
}> {
  const rows = (await query(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today,
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as this_week
    FROM interaction_log
  `)) as { total: string; today: string; this_week: string }[];
  const r = rows[0] || { total: "0", today: "0", this_week: "0" };
  return {
    total: parseInt(r.total),
    today: parseInt(r.today),
    thisWeek: parseInt(r.this_week),
  };
}

export async function checkDbHealth(): Promise<boolean> {
  try {
    await query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export { POSTGRES_URL };
