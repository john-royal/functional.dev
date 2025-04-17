export default {
  async fetch(request, env) {
    const list = await env.MyBucket.list();
    return Response.json({
      list,
    });
  },
} satisfies ExportedHandler<Env>;
