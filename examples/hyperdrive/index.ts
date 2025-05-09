import { Client } from "pg";

export default {
  async fetch(req, env, ctx) {
    const db = new Client(env.HYPERDRIVE.connectionString);
    await db.connect();
    const res = await db.query("SELECT * FROM teams");
    ctx.waitUntil(db.end());
    return Response.json({
      rows: res.rows,
    });
  },
} satisfies ExportedHandler<Env>;
