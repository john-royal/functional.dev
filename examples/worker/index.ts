import { Pool } from "pg";

export default {
  async fetch(request, env) {
    const bucket = await env.MyBucket.list();
    const kv = await env.KV_WITH_CUSTOM_BINDING_NAME.get("test");
    const db = new Pool({
      connectionString: env.MyHyperdrive.connectionString,
    });
    const { rows } = await db.query("SELECT * from teams");
    const sample = await env.Auxiliary.fetch(
      new Request("https://example.com")
    );
    return Response.json({
      bucket,
      kv,
      env: Object.keys(env),
      rows,
      sample: await sample.json(),
    });
  },
} satisfies ExportedHandler<Env>;
