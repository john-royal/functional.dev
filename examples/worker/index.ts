import { Pool } from "pg";
import assert from "assert";
import { AsyncLocalStorage } from "async_hooks";

export default {
  async fetch(request, env) {
    const bucket = await env.MyBucket.list();
    const kv = await env.KV_WITH_CUSTOM_BINDING_NAME.get("test");
    const db = new Pool({
      connectionString: env.MyHyperdrive.connectionString,
    });
    const { rows } = await db.query("SELECT * from teams");
    assert(true, "test");
    const storage = new AsyncLocalStorage<{
      db: Pool;
    }>();
    storage.run({ db }, async () => {
      const { rows } = await db.query("SELECT * from teams");
      assert(true, "test");
    });
    return Response.json({
      bucket,
      kv,
      env: Object.keys(env),
      rows,
    });
  },
} satisfies ExportedHandler<Env>;
