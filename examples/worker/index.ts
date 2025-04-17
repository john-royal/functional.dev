export default {
  async fetch(request, env) {
    const bucket = await env.MyBucket.list();
    const kv = await env.KV_WITH_CUSTOM_BINDING_NAME.get("test");
    return Response.json({
      bucket,
      kv,
      env: Object.keys(env),
    });
  },
} satisfies ExportedHandler<Env>;
