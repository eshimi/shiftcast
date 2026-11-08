// D1 の薄いヘルパー。db は env.DB (D1Database)。
export const all = async (db, sql, ...p) => (await db.prepare(sql).bind(...p).all()).results;
export const get = (db, sql, ...p) => db.prepare(sql).bind(...p).first();
export const run = (db, sql, ...p) => db.prepare(sql).bind(...p).run();
/** [[sql, ...params], ...] を1トランザクションで実行（D1 batch）。大量時は分割。 */
export async function batch(db, stmts, size = 50) {
  for (let i = 0; i < stmts.length; i += size) {
    await db.batch(stmts.slice(i, i + size).map(([sql, ...p]) => db.prepare(sql).bind(...p)));
  }
}
export const getMeta = async (db, k) => (await get(db, 'SELECT v FROM meta WHERE k=?', k))?.v ?? null;
export const setMeta = (db, k, v) =>
  run(db, 'INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v', k, String(v));
