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

// ─── Vote + Cache ────────────────────────────────────────────

function hashQuestion(q: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(q.trim().toLowerCase());
  return hasher.digest("hex");
}

export async function voteInteraction(
  question: string,
  answer: string,
  collection: string,
  model: string,
  provider: string,
  vote: 1 | -1
): Promise<void> {
  try {
    // Update vote on most recent matching interaction
    await query(
      `UPDATE interaction_log SET vote = $1
       WHERE id = (
         SELECT id FROM interaction_log
         WHERE question = $2 AND answer = $3
         ORDER BY created_at DESC LIMIT 1
       )`,
      [vote, question, answer]
    );

    // If upvoted, add to response cache for future users
    if (vote === 1) {
      const qHash = hashQuestion(question);
      await query(
        `INSERT INTO response_cache (question_hash, question, answer, model, provider, collection)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (question_hash, collection)
         DO UPDATE SET answer = $3, vote_count = response_cache.vote_count + 1, updated_at = NOW()`,
        [qHash, question.trim(), answer, model, provider, collection]
      );
    }
  } catch (err) {
    console.error("Failed to record vote:", err);
  }
}

export async function getCachedResponse(
  question: string,
  collection: string
): Promise<{ answer: string; model: string } | null> {
  try {
    const qHash = hashQuestion(question);
    const rows = (await query(
      `SELECT answer, model FROM response_cache
       WHERE question_hash = $1 AND collection = $2 AND vote_count > 0
       ORDER BY vote_count DESC, updated_at DESC LIMIT 1`,
      [qHash, collection]
    )) as { answer: string; model: string }[];
    return rows[0] || null;
  } catch {
    return null;
  }
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
