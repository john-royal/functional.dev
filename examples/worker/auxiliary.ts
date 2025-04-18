export default {
  fetch: async (request, env) => {
    return Response.json({
      message: "Hello from auxiliary worker",
    });
  },
} satisfies ExportedHandler<Env>;
