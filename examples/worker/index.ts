export default {
  async fetch(request, env) {
    return Response.json({
      env,
    });
  },
} satisfies ExportedHandler<Env>;
