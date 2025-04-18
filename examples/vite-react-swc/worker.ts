export default {
  fetch: (req, env) => {
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
